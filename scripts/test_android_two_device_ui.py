#!/usr/bin/env python3
"""Unit coverage for Android UIAutomator selector fallbacks (no emulator needed)."""
import importlib.util
import sys
import unittest
from pathlib import Path
from unittest.mock import patch

HELPER_PATH = Path(__file__).with_name("android-two-device-ui.py")
SPEC = importlib.util.spec_from_file_location("android_two_device_ui", HELPER_PATH)
if SPEC is None or SPEC.loader is None:
    raise RuntimeError("Could not import Android UIAutomator test helper")
ui = importlib.util.module_from_spec(SPEC)
sys.modules[SPEC.name] = ui
SPEC.loader.exec_module(ui)


class AndroidNavigationSelectorTests(unittest.TestCase):
    def _lookup(self, value: str, nodes: list[ui.UiNode]) -> ui.UiNode | None:
        with patch.object(ui, "dump_nodes", return_value=nodes):
            return ui.find_node("emulator-5554", value, False, 1)

    @staticmethod
    def _node(*, text: str = "", desc: str = "", top: int = 1500) -> ui.UiNode:
        return ui.UiNode(text=text, desc=desc, resource_id="", bounds=(10, top, 160, top + 50))

    def test_uses_visible_bottom_tab_when_compound_accessibility_name_missing(self) -> None:
        tab = self._node(text="Connections", top=1500)
        header = self._node(text="Connections", top=100)
        self.assertIs(
            self._lookup("Connections, chats and relationship activity", [header, tab]),
            tab,
        )

    def test_prefers_canonical_accessibility_name_to_fallback(self) -> None:
        tab = self._node(desc="Connections, chats and relationship activity", top=1500)
        same_text = self._node(text="Connections", top=1600)
        self.assertIs(self._lookup("Connections, chats and relationship activity", [same_text, tab]), tab)

    def test_accepts_legacy_compound_selector(self) -> None:
        tab = self._node(text="Connections", top=1500)
        self.assertIs(self._lookup("Connections, chats and activity", [tab]), tab)

    def test_other_controls_still_require_an_exact_match(self) -> None:
        button = self._node(desc="Sign in", top=800)
        self.assertIs(self._lookup("Sign in", [button]), button)


if __name__ == "__main__":
    unittest.main()
