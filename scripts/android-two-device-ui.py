#!/usr/bin/env python3
import argparse
import re
import subprocess
import sys
import time
import xml.etree.ElementTree as ET
from dataclasses import dataclass

BOUNDS_RE = re.compile(r"\[(\d+),(\d+)\]\[(\d+),(\d+)\]")
SAFE_INPUT_RE = re.compile(r"[A-Za-z0-9@._%+\-]{1,160}")
DEVICE_SERIALS = {
    "a": "emulator-5554",
    "b": "emulator-5556",
}
KEY_CODES = {
    "back": "KEYCODE_BACK",
}


@dataclass(frozen=True)
class UiNode:
    text: str
    desc: str
    resource_id: str
    bounds: tuple[int, int, int, int]


def serial_for(device: str) -> str:
    try:
        return DEVICE_SERIALS[device]
    except KeyError as error:
        raise ValueError(f"Unsupported device alias: {device}") from error


def dump_nodes(serial: str) -> list[UiNode]:
    subprocess.run(
        ["adb", "-s", serial, "shell", "uiautomator", "dump", "/sdcard/window.xml"],
        check=True,
        text=True,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
    )
    completed = subprocess.run(
        ["adb", "-s", serial, "shell", "cat", "/sdcard/window.xml"],
        check=True,
        text=True,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
    )
    root = ET.fromstring(completed.stdout)
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
    x = (x1 + x2) // 2
    y = (y1 + y2) // 2
    subprocess.run(
        ["adb", "-s", serial, "shell", "input", "tap", str(x), str(y)],
        check=True,
        text=True,
    )


def type_safe_text(serial: str, value: str) -> None:
    if SAFE_INPUT_RE.fullmatch(value) is None:
        raise ValueError("Typed CI input contains unsupported characters")
    encoded = value.replace("%", "%25")
    subprocess.run(
        ["adb", "-s", serial, "shell", "input", "text", encoded],
        check=True,
        text=True,
    )


def press_key(serial: str, key: str) -> None:
    try:
        key_code = KEY_CODES[key]
    except KeyError as error:
        raise ValueError(f"Unsupported key alias: {key}") from error
    subprocess.run(
        ["adb", "-s", serial, "shell", "input", "keyevent", key_code],
        check=True,
        text=True,
    )


def main() -> int:
    parser = argparse.ArgumentParser(description="Deterministic UIAutomator helper for NEXA Android CI")
    parser.add_argument("--device", required=True, choices=tuple(DEVICE_SERIALS))
    sub = parser.add_subparsers(dest="command", required=True)

    for name in ("wait", "tap", "assert-absent"):
        command = sub.add_parser(name)
        command.add_argument("--value", required=True)
        command.add_argument("--contains", action="store_true")
        command.add_argument("--timeout", type=float, default=20.0)

    type_command = sub.add_parser("type")
    type_command.add_argument("--value", required=True)

    key_command = sub.add_parser("key")
    key_command.add_argument("--name", required=True, choices=tuple(KEY_CODES))

    args = parser.parse_args()
    serial = serial_for(args.device)

    if args.command == "type":
        type_safe_text(serial, args.value)
        return 0

    if args.command == "key":
        press_key(serial, args.name)
        return 0

    node = find_node(serial, args.value, args.contains, args.timeout)
    if args.command == "assert-absent":
        if node is None:
            return 0
        print(
            f"[ui] unexpected node on {args.device}: value={args.value!r} text={node.text!r} desc={node.desc!r}",
            file=sys.stderr,
        )
        return 1

    if node is None:
        print(f"[ui] node not found on {args.device}: {args.value!r}", file=sys.stderr)
        return 1

    if args.command == "tap":
        click_node(serial, node)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
