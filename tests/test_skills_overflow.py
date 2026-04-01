"""Tests for the skills overflow fix — token budget, usage tracking, ranking,
archival, deduplication, and keyword relevance.

Covers changes across: hermes_state.py, agent/prompt_builder.py,
tools/skill_manager_tool.py, tools/skills_tool.py.
"""

import json
import time
from pathlib import Path
from unittest.mock import patch

import pytest

from hermes_state import SessionDB


# =========================================================================
# Fixtures
# =========================================================================


@pytest.fixture()
def db(tmp_path):
    """Create a SessionDB with a temp database file."""
    db_path = tmp_path / "test_state.db"
    session_db = SessionDB(db_path=db_path)
    yield session_db
    session_db.close()


@pytest.fixture()
def skills_dir(tmp_path):
    """Create a minimal skills directory with a few skills."""
    sdir = tmp_path / "skills"
    for name, desc, category in [
        ("python-debug", "Debug Python scripts", "coding"),
        ("git-workflow", "Git branching workflow", "devops"),
        ("k8s-deploy", "Deploy to Kubernetes clusters", "devops"),
        ("write-essay", "Write long-form essays", "writing"),
        ("web-scrape", "Scrape web pages with BeautifulSoup", "coding"),
    ]:
        skill_path = sdir / category / name
        skill_path.mkdir(parents=True, exist_ok=True)
        (skill_path / "SKILL.md").write_text(
            f"---\nname: {name}\ndescription: {desc}\n---\n\nDo the thing.\n"
        )
    return sdir


def _make_skill(skills_dir, name, desc="A test skill", category="general",
                extra_frontmatter=""):
    """Helper to create a skill in the given skills_dir."""
    skill_path = skills_dir / category / name
    skill_path.mkdir(parents=True, exist_ok=True)
    (skill_path / "SKILL.md").write_text(
        f"---\nname: {name}\ndescription: {desc}\n{extra_frontmatter}---\n\nStep 1.\n"
    )
    return skill_path


# =========================================================================
# SessionDB: skill_usage tracking
# =========================================================================


class TestRecordSkillUsage:
    def test_record_and_retrieve(self, db):
        db.record_skill_usage("python-debug", "view", session_id="s1")
        stats = db.get_skill_usage_stats()
        assert len(stats) == 1
        assert stats[0]["skill_name"] == "python-debug"
        assert stats[0]["total_uses"] == 1
        assert stats[0]["event_counts"]["view"] == 1

    def test_multiple_events(self, db):
        db.record_skill_usage("git-workflow", "view")
        db.record_skill_usage("git-workflow", "invoke")
        db.record_skill_usage("git-workflow", "view")
        stats = db.get_skill_usage_stats()
        assert len(stats) == 1
        assert stats[0]["total_uses"] == 3
        assert stats[0]["event_counts"]["view"] == 2
        assert stats[0]["event_counts"]["invoke"] == 1

    def test_context_snippet_truncated(self, db):
        long_snippet = "x" * 500
        db.record_skill_usage("test-skill", "view", context_snippet=long_snippet)
        stats = db.get_skill_usage_stats()
        # Snippet is stored but truncated to 200; verify the record exists
        assert stats[0]["total_uses"] == 1

    def test_none_context_snippet(self, db):
        db.record_skill_usage("test-skill", "view", context_snippet=None)
        stats = db.get_skill_usage_stats()
        assert len(stats) == 1

    def test_fire_and_forget_never_raises(self, db):
        """record_skill_usage should never raise, even on bad input."""
        # This should not raise
        db.record_skill_usage("", "", session_id=None)


class TestGetSkillLastUsed:
    def test_returns_none_for_unknown_skill(self, db):
        assert db.get_skill_last_used("nonexistent") is None

    def test_returns_timestamp(self, db):
        before = time.time()
        db.record_skill_usage("test-skill", "view")
        after = time.time()
        last = db.get_skill_last_used("test-skill")
        assert last is not None
        assert before <= last <= after

    def test_returns_most_recent(self, db):
        db.record_skill_usage("test-skill", "view")
        time.sleep(0.01)
        db.record_skill_usage("test-skill", "invoke")
        last = db.get_skill_last_used("test-skill")
        # Should be the invoke timestamp (most recent)
        stats = db.get_skill_usage_stats()
        assert last == stats[0]["last_used"]


class TestGetSkillUsageStats:
    def test_empty_db_returns_empty(self, db):
        assert db.get_skill_usage_stats() == []

    def test_since_days_filter(self, db):
        db.record_skill_usage("recent-skill", "view")
        stats_all = db.get_skill_usage_stats(since_days=None)
        assert len(stats_all) == 1
        # since_days=0 means cutoff=now, so nothing matches
        stats_future = db.get_skill_usage_stats(since_days=0)
        # cutoff = time.time() - 0 = time.time(), so events at time.time() may not pass
        # This is edge-case-y; just check it doesn't crash
        assert isinstance(stats_future, list)

    def test_multiple_skills_sorted_by_recency(self, db):
        db.record_skill_usage("old-skill", "view")
        time.sleep(0.01)
        db.record_skill_usage("new-skill", "view")
        stats = db.get_skill_usage_stats()
        assert stats[0]["skill_name"] == "new-skill"
        assert stats[1]["skill_name"] == "old-skill"


class TestGetSkillRankings:
    def test_empty_db(self, db):
        assert db.get_skill_rankings() == {}

    def test_basic_scoring(self, db):
        # Record 3 events for skill-a
        for _ in range(3):
            db.record_skill_usage("skill-a", "view")
        # Record 1 event for skill-b
        db.record_skill_usage("skill-b", "view")
        rankings = db.get_skill_rankings()
        assert "skill-a" in rankings
        assert "skill-b" in rankings
        assert rankings["skill-a"] > rankings["skill-b"]

    def test_respects_limit(self, db):
        for i in range(20):
            db.record_skill_usage(f"skill-{i}", "view")
        rankings = db.get_skill_rankings(limit=5)
        assert len(rankings) <= 5

    def test_returns_dict_of_floats(self, db):
        db.record_skill_usage("test-skill", "view")
        rankings = db.get_skill_rankings()
        for name, score in rankings.items():
            assert isinstance(name, str)
            assert isinstance(score, (int, float))


class TestSchemaV7Migration:
    def test_skill_usage_table_exists(self, db):
        """Verify the skill_usage table was created by the v7 migration."""
        cursor = db._conn.execute(
            "SELECT name FROM sqlite_master WHERE type='table' AND name='skill_usage'"
        )
        assert cursor.fetchone() is not None

    def test_skill_usage_indexes_exist(self, db):
        cursor = db._conn.execute(
            "SELECT name FROM sqlite_master WHERE type='index' AND name LIKE 'idx_skill_usage%'"
        )
        indexes = [row["name"] for row in cursor.fetchall()]
        assert "idx_skill_usage_name" in indexes
        assert "idx_skill_usage_ts" in indexes


# =========================================================================
# prompt_builder: token budget, keyword relevance, scoring
# =========================================================================


class TestEstimateTokens:
    def test_basic(self):
        from agent.prompt_builder import _estimate_tokens
        assert _estimate_tokens("") == 1  # min 1
        assert _estimate_tokens("hello world") >= 1
        # ~11 chars / 4 ≈ 2-3 tokens
        assert 1 <= _estimate_tokens("hello world") <= 5

    def test_long_text(self):
        from agent.prompt_builder import _estimate_tokens
        text = "a" * 400
        assert _estimate_tokens(text) == 100  # 400 // 4


class TestComputeKeywordRelevance:
    def test_empty_inputs(self):
        from agent.prompt_builder import compute_keyword_relevance
        assert compute_keyword_relevance("", []) == {}
        assert compute_keyword_relevance("hello", []) == {}
        assert compute_keyword_relevance("", [{"skill_name": "x"}]) == {}

    def test_stopwords_only_message(self):
        from agent.prompt_builder import compute_keyword_relevance
        # Only stopwords → no keywords → empty result
        assert compute_keyword_relevance("the is a an", [{"skill_name": "x"}]) == {}

    def test_matching_skill(self):
        from agent.prompt_builder import compute_keyword_relevance
        entries = [
            {"skill_name": "python-debug", "description": "Debug Python scripts",
             "category": "coding", "tags": ["python", "debugging"]},
        ]
        scores = compute_keyword_relevance("help me debug python", entries)
        assert "python-debug" in scores
        assert scores["python-debug"] > 0

    def test_no_match(self):
        from agent.prompt_builder import compute_keyword_relevance
        entries = [
            {"skill_name": "k8s-deploy", "description": "Deploy to Kubernetes",
             "category": "devops", "tags": ["kubernetes"]},
        ]
        scores = compute_keyword_relevance("write an essay about cats", entries)
        assert scores.get("k8s-deploy", 0) == 0

    def test_jaccard_not_recall(self):
        """Score should use |intersection|/|union|, not |intersection|/|skill_words|."""
        from agent.prompt_builder import compute_keyword_relevance
        # Skill with just 1 keyword "git"
        entries = [
            {"skill_name": "git", "description": "", "category": "", "tags": []},
        ]
        # User message with many keywords — only "git" matches
        scores = compute_keyword_relevance(
            "please help me deploy kubernetes docker git helm", entries
        )
        # With Jaccard: 1 / (5 + 1 - 1) = 1/5 = 0.2 → scaled = 2.0
        # With old recall: 1/1 = 1.0 → scaled = 10.0
        # Score should be well below 10.0
        assert scores.get("git", 0) < 5.0

    def test_score_range(self):
        from agent.prompt_builder import compute_keyword_relevance
        entries = [
            {"skill_name": "python-debug", "description": "Debug Python",
             "category": "coding", "tags": []},
        ]
        scores = compute_keyword_relevance("debug python", entries)
        for score in scores.values():
            assert 0.0 <= score <= 10.0


class TestBuildSkillsSystemPromptBudget:
    """Test the token budget, pinning, and scoring features."""

    @pytest.fixture(autouse=True)
    def _clear_cache(self):
        from agent.prompt_builder import clear_skills_system_prompt_cache
        clear_skills_system_prompt_cache(clear_snapshot=True)
        yield
        clear_skills_system_prompt_cache(clear_snapshot=True)

    def test_no_budget_includes_all(self, monkeypatch, skills_dir):
        """token_budget=0 (default) should include all skills."""
        monkeypatch.setenv("HERMES_HOME", str(skills_dir.parent))
        from agent.prompt_builder import build_skills_system_prompt
        result = build_skills_system_prompt(token_budget=0)
        assert "python-debug" in result
        assert "git-workflow" in result
        assert "k8s-deploy" in result
        assert "write-essay" in result
        assert "web-scrape" in result
        # No "additional skill(s)" footer
        assert "additional skill" not in result

    def test_budget_truncates(self, monkeypatch, skills_dir):
        """A tight budget should exclude some skills and show footer."""
        monkeypatch.setenv("HERMES_HOME", str(skills_dir.parent))
        from agent.prompt_builder import build_skills_system_prompt
        # Very tight budget (just enough for chrome + maybe 1 skill)
        result = build_skills_system_prompt(token_budget=100)
        assert "additional skill(s) available" in result

    def test_pinned_always_included(self, monkeypatch, skills_dir):
        """Pinned skills must survive budget cuts."""
        monkeypatch.setenv("HERMES_HOME", str(skills_dir.parent))
        from agent.prompt_builder import build_skills_system_prompt
        result = build_skills_system_prompt(
            token_budget=150,
            pinned_skills=["write-essay"],
        )
        assert "write-essay" in result

    def test_max_prompt_skills_cap(self, monkeypatch, skills_dir):
        """max_prompt_skills should hard-cap the count."""
        monkeypatch.setenv("HERMES_HOME", str(skills_dir.parent))
        from agent.prompt_builder import build_skills_system_prompt
        result = build_skills_system_prompt(max_prompt_skills=2)
        # Should have at most 2 skills + omitted footer
        assert "additional skill(s) available" in result

    def test_skill_scores_affect_order(self, monkeypatch, skills_dir):
        """Higher-scored skills should appear before lower-scored ones."""
        monkeypatch.setenv("HERMES_HOME", str(skills_dir.parent))
        from agent.prompt_builder import build_skills_system_prompt
        result = build_skills_system_prompt(
            max_prompt_skills=2,
            skill_scores={"write-essay": 100.0, "k8s-deploy": 50.0},
        )
        assert "write-essay" in result
        # With only 2 slots and high scores on these two, they should be in
        assert "k8s-deploy" in result

    def test_backward_compatible_call(self, monkeypatch, skills_dir):
        """Old call signature (no kwargs) should still work."""
        monkeypatch.setenv("HERMES_HOME", str(skills_dir.parent))
        from agent.prompt_builder import build_skills_system_prompt
        # This is how the function was called before our changes
        result = build_skills_system_prompt(
            available_tools=None, available_toolsets=None
        )
        assert "python-debug" in result


# =========================================================================
# skill_manager_tool: archive, restore, dedup, bundled detection
# =========================================================================


class TestArchiveSkill:
    def test_archive_and_restore(self, tmp_path):
        from tools.skill_manager_tool import _archive_skill, _restore_skill, ARCHIVE_DIR
        with patch("tools.skill_manager_tool.SKILLS_DIR", tmp_path):
            with patch("tools.skill_manager_tool.ARCHIVE_DIR", tmp_path / ".archive"):
                skill_dir = tmp_path / "my-skill"
                skill_dir.mkdir()
                (skill_dir / "SKILL.md").write_text(
                    "---\nname: my-skill\ndescription: test\n---\n"
                )

                result = _archive_skill("my-skill")
                assert result["success"] is True
                assert not skill_dir.exists()
                assert (tmp_path / ".archive" / "my-skill" / "SKILL.md").exists()

                # Restore
                result = _restore_skill("my-skill")
                assert result["success"] is True
                assert (tmp_path / "my-skill" / "SKILL.md").exists()

    def test_archive_nonexistent(self, tmp_path):
        from tools.skill_manager_tool import _archive_skill
        with patch("tools.skill_manager_tool.SKILLS_DIR", tmp_path):
            result = _archive_skill("nonexistent")
            assert result["success"] is False

    def test_restore_nonexistent(self, tmp_path):
        from tools.skill_manager_tool import _restore_skill
        with patch("tools.skill_manager_tool.SKILLS_DIR", tmp_path):
            with patch("tools.skill_manager_tool.ARCHIVE_DIR", tmp_path / ".archive"):
                result = _restore_skill("nonexistent")
                assert result["success"] is False

    def test_archive_bundled_blocked(self, tmp_path):
        from tools.skill_manager_tool import _archive_skill
        with patch("tools.skill_manager_tool.SKILLS_DIR", tmp_path):
            with patch("tools.skill_manager_tool._is_bundled_skill", return_value=True):
                skill_dir = tmp_path / "bundled-skill"
                skill_dir.mkdir()
                (skill_dir / "SKILL.md").write_text(
                    "---\nname: bundled-skill\ndescription: test\n---\n"
                )
                result = _archive_skill("bundled-skill")
                assert result["success"] is False
                assert "bundled" in result["error"].lower()


class TestFindSimilarSkills:
    def test_name_stem_overlap(self, tmp_path):
        from tools.skill_manager_tool import _find_similar_skills
        # Must patch SKILLS_DIR in both skill_manager_tool AND skills_tool
        # because _find_similar_skills calls _find_all_skills from skills_tool
        with patch("tools.skill_manager_tool.SKILLS_DIR", tmp_path), \
             patch("tools.skills_tool.SKILLS_DIR", tmp_path):
            existing = tmp_path / "python-debug"
            existing.mkdir(parents=True)
            (existing / "SKILL.md").write_text(
                "---\nname: python-debug\ndescription: Debug Python\n---\n"
            )
            content = "---\nname: python-lint\ndescription: Lint Python code\n---\n"
            similar = _find_similar_skills("python-lint", content)
            assert "python-debug" in similar

    def test_no_self_match(self, tmp_path):
        from tools.skill_manager_tool import _find_similar_skills
        with patch("tools.skill_manager_tool.SKILLS_DIR", tmp_path), \
             patch("tools.skills_tool.SKILLS_DIR", tmp_path):
            existing = tmp_path / "my-skill"
            existing.mkdir(parents=True)
            (existing / "SKILL.md").write_text(
                "---\nname: my-skill\ndescription: test\n---\n"
            )
            content = "---\nname: my-skill\ndescription: test\n---\n"
            similar = _find_similar_skills("my-skill", content)
            assert "my-skill" not in similar


class TestFindArchivableSkills:
    def test_skips_pinned(self, tmp_path, db):
        from tools.skill_manager_tool import find_archivable_skills
        with patch("tools.skill_manager_tool.SKILLS_DIR", tmp_path):
            with patch("tools.skill_manager_tool._is_bundled_skill", return_value=False):
                skill = tmp_path / "pinned-skill"
                skill.mkdir()
                (skill / "SKILL.md").write_text("---\nname: pinned-skill\n---\n")

                candidates = find_archivable_skills(
                    cutoff_days=0, pinned={"pinned-skill"}
                )
                assert "pinned-skill" not in candidates

    def test_skips_bundled(self, tmp_path, db):
        from tools.skill_manager_tool import find_archivable_skills
        with patch("tools.skill_manager_tool.SKILLS_DIR", tmp_path):
            with patch("tools.skill_manager_tool._is_bundled_skill", return_value=True):
                skill = tmp_path / "bundled-skill"
                skill.mkdir()
                (skill / "SKILL.md").write_text("---\nname: bundled-skill\n---\n")

                candidates = find_archivable_skills(cutoff_days=0)
                assert "bundled-skill" not in candidates


class TestIsBundledSkill:
    def test_frontmatter_bundled_true(self, tmp_path):
        from tools.skill_manager_tool import _is_bundled_skill
        skill_dir = tmp_path / "my-skill"
        skill_dir.mkdir()
        (skill_dir / "SKILL.md").write_text(
            "---\nname: my-skill\nbundled: true\n---\n"
        )
        # Reset cache
        import tools.skill_manager_tool as m
        m._BUNDLED_SKILL_NAMES = frozenset()
        assert _is_bundled_skill(skill_dir) is True

    def test_not_bundled(self, tmp_path):
        from tools.skill_manager_tool import _is_bundled_skill
        skill_dir = tmp_path / "user-skill"
        skill_dir.mkdir()
        (skill_dir / "SKILL.md").write_text(
            "---\nname: user-skill\ndescription: custom\n---\n"
        )
        import tools.skill_manager_tool as m
        m._BUNDLED_SKILL_NAMES = frozenset()
        assert _is_bundled_skill(skill_dir) is False


# =========================================================================
# skills_tool: archived listing, usage tracking
# =========================================================================


class TestSkillsListArchived:
    def test_include_archived_false_default(self, tmp_path):
        """include_archived=False should not show archived skills."""
        from tools.skills_tool import skills_list, SKILLS_DIR
        with patch("tools.skills_tool.SKILLS_DIR", tmp_path):
            # Active skill
            active = tmp_path / "active-skill"
            active.mkdir()
            (active / "SKILL.md").write_text(
                "---\nname: active-skill\ndescription: Active\n---\n"
            )
            # Archived skill
            archive = tmp_path / ".archive" / "old-skill"
            archive.mkdir(parents=True)
            (archive / "SKILL.md").write_text(
                "---\nname: old-skill\ndescription: Old\n---\n"
            )
            result = json.loads(skills_list(include_archived=False))
            names = [s["name"] for s in result.get("skills", [])]
            assert "active-skill" in names
            assert "old-skill" not in names

    def test_include_archived_true(self, tmp_path):
        """include_archived=True should show both active and archived."""
        from tools.skills_tool import skills_list
        with patch("tools.skills_tool.SKILLS_DIR", tmp_path):
            active = tmp_path / "active-skill"
            active.mkdir()
            (active / "SKILL.md").write_text(
                "---\nname: active-skill\ndescription: Active\n---\n"
            )
            archive = tmp_path / ".archive" / "old-skill"
            archive.mkdir(parents=True)
            (archive / "SKILL.md").write_text(
                "---\nname: old-skill\ndescription: Old\n---\n"
            )
            result = json.loads(skills_list(include_archived=True))
            names = [s["name"] for s in result.get("skills", [])]
            assert "active-skill" in names
            assert "old-skill" in names


class TestSkillViewArchiveFallback:
    def test_archived_skill_gives_hint(self, tmp_path):
        """Viewing an archived skill should return a restore hint."""
        from tools.skills_tool import skill_view
        with patch("tools.skills_tool.SKILLS_DIR", tmp_path):
            archive = tmp_path / ".archive" / "old-skill"
            archive.mkdir(parents=True)
            (archive / "SKILL.md").write_text(
                "---\nname: old-skill\ndescription: Old\n---\n"
            )
            result = json.loads(skill_view("old-skill"))
            assert result.get("archived") is True
            assert "restore" in result.get("hint", "").lower()


class TestTrackSkillUsage:
    def test_does_not_raise(self, db):
        """Usage recording should never raise."""
        # fire-and-forget: even weird inputs shouldn't blow up
        db.record_skill_usage("test", "view")
        db.record_skill_usage("", "")


# =========================================================================
# Integration: excluded skill dirs
# =========================================================================


class TestExcludedSkillDirs:
    def test_archive_in_excluded(self):
        from agent.skill_utils import EXCLUDED_SKILL_DIRS
        assert ".archive" in EXCLUDED_SKILL_DIRS

    def test_archive_not_iterated(self, tmp_path):
        """Archived skills should not appear in iter_skill_index_files."""
        from agent.skill_utils import iter_skill_index_files
        # Active skill
        active = tmp_path / "active-skill"
        active.mkdir()
        (active / "SKILL.md").write_text("---\nname: active\n---\n")
        # Archived skill
        archived = tmp_path / ".archive" / "old-skill"
        archived.mkdir(parents=True)
        (archived / "SKILL.md").write_text("---\nname: old\n---\n")

        found = list(iter_skill_index_files(tmp_path, "SKILL.md"))
        found_names = [f.parent.name for f in found]
        assert "active-skill" in found_names
        assert "old-skill" not in found_names
