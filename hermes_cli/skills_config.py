"""
Skills configuration for Hermes Agent.
`hermes skills` enters this module.

Toggle individual skills or categories on/off, globally or per-platform.
Config stored in ~/.hermes/config.yaml under:

  skills:
    disabled: [skill-a, skill-b]          # global disabled list
    platform_disabled:                    # per-platform overrides
      telegram: [skill-c]
      cli: []
"""
from typing import List, Optional, Set

from hermes_cli.config import load_config, save_config
from hermes_cli.colors import Colors, color

PLATFORMS = {
    "cli":      "🖥️  CLI",
    "telegram": "📱 Telegram",
    "discord":  "💬 Discord",
    "slack":    "💼 Slack",
    "whatsapp": "📱 WhatsApp",
    "signal":   "📡 Signal",
    "email":    "📧 Email",
    "homeassistant": "🏠 Home Assistant",
    "mattermost": "💬 Mattermost",
    "matrix":   "💬 Matrix",
    "dingtalk": "💬 DingTalk",
}

# ─── Config Helpers ───────────────────────────────────────────────────────────

def get_disabled_skills(config: dict, platform: Optional[str] = None) -> Set[str]:
    """Return disabled skill names. Platform-specific list falls back to global."""
    skills_cfg = config.get("skills", {})
    global_disabled = set(skills_cfg.get("disabled", []))
    if platform is None:
        return global_disabled
    platform_disabled = skills_cfg.get("platform_disabled", {}).get(platform)
    if platform_disabled is None:
        return global_disabled
    return set(platform_disabled)


def save_disabled_skills(config: dict, disabled: Set[str], platform: Optional[str] = None):
    """Persist disabled skill names to config."""
    config.setdefault("skills", {})
    if platform is None:
        config["skills"]["disabled"] = sorted(disabled)
    else:
        config["skills"].setdefault("platform_disabled", {})
        config["skills"]["platform_disabled"][platform] = sorted(disabled)
    save_config(config)


# ─── Skill Discovery ─────────────────────────────────────────────────────────

def _list_all_skills() -> List[dict]:
    """Return all installed skills (ignoring disabled state)."""
    try:
        from tools.skills_tool import _find_all_skills
        return _find_all_skills(skip_disabled=True)
    except Exception:
        return []


def _get_categories(skills: List[dict]) -> List[str]:
    """Return sorted unique category names (None -> 'uncategorized')."""
    return sorted({s["category"] or "uncategorized" for s in skills})


# ─── Platform Selection ──────────────────────────────────────────────────────

def _select_platform() -> Optional[str]:
    """Ask user which platform to configure, or global."""
    options = [("global", "All platforms (global default)")] + list(PLATFORMS.items())
    print()
    print(color("  Configure skills for:", Colors.BOLD))
    for i, (key, label) in enumerate(options, 1):
        print(f"  {i}. {label}")
    print()
    try:
        raw = input(color("  Select [1]: ", Colors.YELLOW)).strip()
    except (KeyboardInterrupt, EOFError):
        return None
    if not raw:
        return None  # global
    try:
        idx = int(raw) - 1
        if 0 <= idx < len(options):
            key = options[idx][0]
            return None if key == "global" else key
    except ValueError:
        pass
    return None


# ─── Category Toggle ─────────────────────────────────────────────────────────

def _toggle_by_category(skills: List[dict], disabled: Set[str]) -> Set[str]:
    """Toggle all skills in a category at once."""
    from hermes_cli.curses_ui import curses_checklist

    categories = _get_categories(skills)
    cat_labels = []
    # A category is "enabled" (checked) when NOT all its skills are disabled
    pre_selected = set()
    for i, cat in enumerate(categories):
        cat_skills = [s["name"] for s in skills if (s["category"] or "uncategorized") == cat]
        cat_labels.append(f"{cat} ({len(cat_skills)} skills)")
        if not all(s in disabled for s in cat_skills):
            pre_selected.add(i)

    chosen = curses_checklist(
        "Categories — toggle entire categories",
        cat_labels, pre_selected, cancel_returns=pre_selected,
    )

    new_disabled = set(disabled)
    for i, cat in enumerate(categories):
        cat_skills = {s["name"] for s in skills if (s["category"] or "uncategorized") == cat}
        if i in chosen:
            new_disabled -= cat_skills  # category enabled → remove from disabled
        else:
            new_disabled |= cat_skills  # category disabled → add to disabled
    return new_disabled


# ─── Entry Point ──────────────────────────────────────────────────────────────

def skills_command(args=None):
    """Entry point for `hermes skills`."""
    from hermes_cli.curses_ui import curses_checklist

    config = load_config()
    skills = _list_all_skills()

    if not skills:
        print(color("  No skills installed.", Colors.DIM))
        return

    # Step 1: Select platform
    platform = _select_platform()
    platform_label = PLATFORMS.get(platform, "All platforms") if platform else "All platforms"

    # Step 2: Select mode — individual or by category
    print()
    print(color(f"  Configure for: {platform_label}", Colors.DIM))
    print()
    print("  1. Toggle individual skills")
    print("  2. Toggle by category")
    print()
    try:
        mode = input(color("  Select [1]: ", Colors.YELLOW)).strip() or "1"
    except (KeyboardInterrupt, EOFError):
        return

    disabled = get_disabled_skills(config, platform)

    if mode == "2":
        new_disabled = _toggle_by_category(skills, disabled)
    else:
        # Build labels and map indices → skill names
        labels = [
            f"{s['name']}  ({s['category'] or 'uncategorized'})  —  {s['description'][:55]}"
            for s in skills
        ]
        # "selected" = enabled (not disabled) — matches the [✓] convention
        pre_selected = {i for i, s in enumerate(skills) if s["name"] not in disabled}
        chosen = curses_checklist(
            f"Skills for {platform_label}",
            labels, pre_selected, cancel_returns=pre_selected,
        )
        # Anything NOT chosen is disabled
        new_disabled = {skills[i]["name"] for i in range(len(skills)) if i not in chosen}

    if new_disabled == disabled:
        print(color("  No changes.", Colors.DIM))
        return

    save_disabled_skills(config, new_disabled, platform)
    enabled_count = len(skills) - len(new_disabled)
    print(color(f"✓ Saved: {enabled_count} enabled, {len(new_disabled)} disabled ({platform_label}).", Colors.GREEN))


# ─── Skills Overflow Commands ────────────────────────────────────────────────

def skills_overflow_command(args):
    """Handle stats/archive/restore/prune subcommands."""
    action = args.skills_action

    if action == "stats":
        _cmd_stats(getattr(args, "days", None))
    elif action == "archive":
        _cmd_archive(args.name)
    elif action == "restore":
        _cmd_restore(args.name)
    elif action == "prune":
        _cmd_prune(getattr(args, "days", 90), getattr(args, "yes", False))


def _cmd_stats(since_days):
    """Show skill usage statistics ranked by usage."""
    import datetime

    try:
        from hermes_state import SessionDB
        db = SessionDB()
        stats = db.get_skill_usage_stats(since_days=since_days)
    except Exception as e:
        print(color(f"Error loading stats: {e}", Colors.RED))
        return

    if not stats:
        period = f"last {since_days} days" if since_days else "all time"
        print(color(f"No skill usage data found ({period}).", Colors.DIM))
        print("Usage data is recorded when skills are viewed, invoked, or managed.")
        return

    period_label = f"last {since_days} days" if since_days else "all time"
    print(color(f"\nSkill Usage Stats ({period_label})", Colors.BOLD))
    print(f"{'Skill':<30} {'Uses':>6} {'Last Used':<20} {'Events'}")
    print("─" * 80)

    for s in stats:
        name = s["skill_name"][:29]
        total = s["total_uses"]
        last_ts = s["last_used"]
        last_str = datetime.datetime.fromtimestamp(last_ts).strftime("%Y-%m-%d %H:%M") if last_ts else "never"
        events = ", ".join(f"{k}:{v}" for k, v in sorted(s["event_counts"].items()))
        print(f"  {name:<28} {total:>6} {last_str:<20} {events}")

    print(f"\n  Total: {len(stats)} skills with recorded usage")


def _cmd_archive(name):
    """Archive a single skill."""
    from tools.skill_manager_tool import _archive_skill
    result = _archive_skill(name)
    if result.get("success"):
        print(color(f"✓ {result['message']}", Colors.GREEN))
        try:
            from agent.prompt_builder import clear_skills_system_prompt_cache
            clear_skills_system_prompt_cache(clear_snapshot=True)
        except Exception:
            pass
    else:
        print(color(f"✗ {result['error']}", Colors.RED))


def _cmd_restore(name):
    """Restore a single skill from archive."""
    from tools.skill_manager_tool import _restore_skill
    result = _restore_skill(name)
    if result.get("success"):
        print(color(f"✓ {result['message']}", Colors.GREEN))
        try:
            from agent.prompt_builder import clear_skills_system_prompt_cache
            clear_skills_system_prompt_cache(clear_snapshot=True)
        except Exception:
            pass
    else:
        print(color(f"✗ {result['error']}", Colors.RED))
        if result.get("archived_skills"):
            print(f"  Available archived skills: {', '.join(result['archived_skills'])}")


def _cmd_prune(days, skip_confirm):
    """Bulk archive skills unused for more than N days."""
    from tools.skill_manager_tool import find_archivable_skills, _archive_skill

    config = load_config()
    pinned = set(config.get("skills", {}).get("pinned_skills", []))

    candidates = find_archivable_skills(days, pinned=pinned)

    if not candidates:
        print(color(f"No skills unused for >{days} days found.", Colors.DIM))
        return

    print(color(f"\nSkills unused for >{days} days ({len(candidates)}):", Colors.BOLD))
    for name in sorted(candidates):
        print(f"  - {name}")

    if not skip_confirm:
        try:
            answer = input(f"\nArchive these {len(candidates)} skills? [y/N] ").strip().lower()
        except (EOFError, KeyboardInterrupt):
            print("\nAborted.")
            return
        if answer not in ("y", "yes"):
            print("Aborted.")
            return

    archived = 0
    for name in candidates:
        result = _archive_skill(name)
        if result.get("success"):
            print(color(f"  ✓ Archived {name}", Colors.GREEN))
            archived += 1
        else:
            print(color(f"  ✗ {name}: {result.get('error', 'unknown error')}", Colors.RED))

    if archived:
        try:
            from agent.prompt_builder import clear_skills_system_prompt_cache
            clear_skills_system_prompt_cache(clear_snapshot=True)
        except Exception:
            pass
    print(f"\nArchived {archived}/{len(candidates)} skills.")
