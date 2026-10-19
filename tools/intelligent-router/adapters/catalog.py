#!/usr/bin/env python3
"""Read the installed Codex catalog using managed ChatGPT auth; never runs inference."""
import json
import selectors
import subprocess
import time


def discover():
    process = subprocess.Popen(["codex", "app-server", "--listen", "stdio://"],
                               stdin=subprocess.PIPE, stdout=subprocess.PIPE,
                               stderr=subprocess.DEVNULL, text=True, bufsize=1)
    selector = selectors.DefaultSelector()
    selector.register(process.stdout, selectors.EVENT_READ)

    def request(identifier, method, params):
        process.stdin.write(json.dumps({"id": identifier, "method": method, "params": params}) + "\n")
        process.stdin.flush()
        deadline = time.monotonic() + 30
        while time.monotonic() < deadline:
            if selector.select(1):
                line = process.stdout.readline()
                if not line:
                    raise RuntimeError("Codex app-server exited")
                response = json.loads(line)
                if response.get("id") == identifier:
                    if "error" in response:
                        raise RuntimeError("Codex rejected " + method)
                    return response["result"]
        raise TimeoutError(method)

    try:
        request(1, "initialize", {"clientInfo": {"name": "intelligent_router_probe", "version": "0.1.0"}})
        process.stdin.write('{"method":"initialized"}\n')
        process.stdin.flush()
        account = request(2, "account/read", {"refreshToken": False}).get("account") or {}
        if account.get("type") != "chatgpt":
            raise RuntimeError("Managed ChatGPT login required; API-key/provider fallback disabled")
        models, cursor, identifier = [], None, 3
        while True:
            params = {"limit": 100, "includeHidden": True}
            if cursor:
                params["cursor"] = cursor
            result = request(identifier, "model/list", params)
            models.extend({k: model.get(k) for k in ["model", "hidden", "isDefault",
                          "defaultReasoningEffort", "supportedReasoningEfforts"]}
                          for model in result["data"])
            cursor = result.get("nextCursor")
            if not cursor:
                break
            identifier += 1
            if identifier > 20:
                raise RuntimeError("Unexpected catalog pagination")
        return {"auth_type": account["type"], "models": models,
                "entitlement_verified": False, "inference_performed": False}
    finally:
        selector.close()
        process.terminate()
        try:
            process.wait(timeout=5)
        except subprocess.TimeoutExpired:
            process.kill()
            process.wait()


if __name__ == "__main__":
    print(json.dumps(discover(), ensure_ascii=False, indent=2))
