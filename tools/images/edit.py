"""Draws a picture with OpenAI image edits through the LangWatch AI Gateway (docs/layers/g-images.md).

Copied from an internal mascot tool, unchanged apart from this docstring.

Usage: edit.py <out-prefix> "<prompt>" <n> <style-ref.png> [<composition-ref.png> ...]
The key is a gateway virtual key: MASCOT_API_KEY, else LANGWATCH_GATEWAY_OXVK from the vault.
Results land in <out-prefix>-<i>.png.
"""

import base64
import concurrent.futures as cf
import json
import os
import sys
import urllib.error
import urllib.request
import uuid

MODEL = os.environ.get("MASCOT_MODEL", "openai/gpt-image-2.5-flare")
URL = os.environ.get("MASCOT_GATEWAY_URL", "https://gateway.langwatch.ai/v1") + "/images/edits"


def api_key() -> str:
    key = os.environ.get("MASCOT_API_KEY") or os.environ.get("LANGWATCH_GATEWAY_OXVK")
    if not key:
        sys.exit("No gateway key: run under the vault with LANGWATCH_GATEWAY_OXVK, or set MASCOT_API_KEY.")
    return key


def edit(out: str, prompt: str, images: list[str]) -> str:
    boundary = uuid.uuid4().hex

    def field(name: str, value: str) -> bytes:
        return f'--{boundary}\r\nContent-Disposition: form-data; name="{name}"\r\n\r\n{value}\r\n'.encode()

    body = b"".join(
        field(k, v)
        for k, v in [
            ("model", MODEL),
            ("prompt", prompt),
            ("size", os.environ.get("MASCOT_SIZE", "1024x1024")),
            ("quality", "high"),
            ("background", "transparent"),
            ("n", "1"),
        ]
    )
    for image in images:
        head = (
            f'--{boundary}\r\nContent-Disposition: form-data; name="image[]"; '
            f'filename="{os.path.basename(image)}"\r\nContent-Type: image/png\r\n\r\n'
        )
        body += head.encode() + open(image, "rb").read() + b"\r\n"
    body += f"--{boundary}--\r\n".encode()
    request = urllib.request.Request(
        URL,
        data=body,
        headers={
            "Authorization": f"Bearer {api_key()}",
            "Content-Type": f"multipart/form-data; boundary={boundary}",
        },
    )
    try:
        data = json.load(urllib.request.urlopen(request, timeout=280))
    except urllib.error.HTTPError as error:
        return f"{out} HTTP {error.code} {error.read()[:300]!r}"
    with open(out, "wb") as file:
        file.write(base64.b64decode(data["data"][0]["b64_json"]))
    return f"{out} ok"


def main() -> None:
    prefix, prompt, count, images = sys.argv[1], sys.argv[2], int(sys.argv[3]), sys.argv[4:]
    with cf.ThreadPoolExecutor(count) as pool:
        for line in pool.map(lambda i: edit(f"{prefix}-{i}.png", prompt, images), range(count)):
            print(line, flush=True)


if __name__ == "__main__":
    main()
