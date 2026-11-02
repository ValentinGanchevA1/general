#!/usr/bin/env python3
import argparse
import re
import subprocess
import sys
import time
import xml.etree.ElementTree as ET
from dataclasses import dataclass

BOUNDS_RE = re.compile(r"\[(\d+),(\d+)\]\[(\d+),(\d+)\]")


@dataclass(frozen=True)
class UiNode:
    text: str
    desc: str
    resource_id: str
    bounds: tuple[int, int, int, int]


def adb(serial: str, *args: str, capture: bool = False) -> str:
    completed = subprocess.run(
        ["adb", "-s", serial, *args],
        check=True,
        text=True,
        stdout=subprocess.PIPE if capture else None,
        stderr=subprocess.PIPE if capture else None,
    )
    return completed.stdout if capture else ""


def dump_nodes(serial: str) -> list[UiNode]:
    adb(serial, "shell", "uiautomator", "dump", "/sdcard/window.xml", capture=True)
    xml = adb(serial, "shell", "cat", "/sdcard/window.xml", capture=True)
    root = ET.fromstring(xml)
    nodes: list[UiNode] = []
    for element in root.iter("node"):
        match = BOUNDS_RE.fullmatch(element.attrib.get("bounds", ""))
        if not match:
            continue
        nodes.append(
            UiNode(
                text=element.attrib.get("text", ""),
                desc=element.attrib.get("content-desc", ""),
                resource_id=element.attrib.get("resource-id", ""),
                bounds=tuple(int(value) for value in match.groups()),
            )
        )
    return nodes


def matches(node: UiNode, value: str, contains: bool) -> bool:
    candidates = (node.text, node.desc, node.resource_id)
    if contains:
        return any(value in candidate for candidate in candidates)
    return any(value == candidate for candidate in candidates)


def find_node(serial: str, value: str, contains: bool, timeout: float) -> UiNode | None:
    deadline = time.monotonic() + timeout
    last_error: Exception | None = None
    while time.monotonic() < deadline:
        try:
            for node in dump_nodes(serial):
                if matches(node, value, contains):
                    return node
        except (subprocess.CalledProcessError, ET.ParseError) as error:
            last_error = error
        time.sleep(0.75)
    if last_error:
        print(f"[ui] last dump error: {last_error}", file=sys.stderr)
    return None


def click_node(serial: str, node: UiNode) -> None:
    x1, y1, x2, y2 = node.bounds
    adb(serial, "shell", "input", "tap", str((x1 + x2) // 2), str((y1 + y2) // 2))


def main() -> int:
    parser = argparse.ArgumentParser(description="Small deterministic UIAutomator helper for NEXA Android CI")
    parser.add_argument("--serial", required=True)
    sub = parser.add_subparsers(dest="command", required=True)

    for name in ("wait", "tap", "assert-absent"):
        command = sub.add_parser(name)
        command.add_argument("--value", required=True)
        command.add_argument("--contains", action="store_true")
        command.add_argument("--timeout", type=float, default=20.0)

    type_command = sub.add_parser("type")
    type_command.add_argument("--value", required=True)

    key_command = sub.add_parser("key")
    key_command.add_argument("--code", required=True)

    args = parser.parse_args()

    if args.command == "type":
        encoded = args.value.replace("%", "%25").replace(" ", "%s")
        adb(args.serial, "shell", "input", "text", encoded)
        return 0

    if args.command == "key":
        adb(args.serial, "shell", "input", "keyevent", args.code)
        return 0

    node = find_node(args.serial, args.value, args.contains, args.timeout)
    if args.command == "assert-absent":
        if node is None:
            return 0
        print(
            f"[ui] unexpected node on {args.serial}: value={args.value!r} text={node.text!r} desc={node.desc!r}",
            file=sys.stderr,
        )
        return 1

    if node is None:
        print(f"[ui] node not found on {args.serial}: {args.value!r}", file=sys.stderr)
        return 1

    if args.command == "tap":
        click_node(args.serial, node)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
