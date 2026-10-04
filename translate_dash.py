import json

with open("raw_dash.json") as f:
    d = json.load(f)

dash = d.get("dashboard", d)

# A simple translation dictionary based on the titles extracted
translations = {
    "核心概览 (Core Overview)": "Core Overview",
    "延迟分析 (Latency Analysis)": "Latency Analysis",
    "首 Token 延迟 (TTFT)": "Time to First Token (TTFT)",
    "Token 间延迟 (ITL)": "Inter-Token Latency (ITL)",
    "端到端请求延迟 (E2E)": "End-to-End Request Latency (E2E)",
    "队列等待时间 (按 Engine / TP Rank)": "Queue Wait Time (by Engine / TP Rank)",
    "吞吐量与 Token (Throughput & Tokens)": "Throughput & Tokens",
    "Token 吞吐量 (Prefill / Decode)": "Token Throughput (Prefill / Decode)",
    "实时 Token 处理 (按 Engine / TP Rank)": "Real-time Token Processing (by Engine / TP Rank)",
    "缓存 Token 统计": "Cache Token Statistics",
    "Engine Step / CUDA Graph 指标": "Engine Step / CUDA Graph Metrics",
    "队列与资源 (Queue & Resources)": "Queue & Resources",
    "运行中请求": "Running Requests",
    "等待队列请求": "Waiting Queue Requests",
    "Token 容量 / Max Tokens": "Token Capacity / Max Tokens",
    "新 Token / Prefill KV 计算比例": "New Token / Prefill KV Calculation Ratio",
    "CPU / 请求阶段耗时": "CPU / Request Phase Time",
    "KV Cache 驱逐时间": "KV Cache Eviction Time",
    "节点/Engine 分布 (Node / Engine Distribution)": "Node / Engine Distribution",
    "Decode 吞吐量 (按 Engine / TP Rank)": "Decode Throughput (by Engine / TP Rank)",
    "Prefill 吞吐量 (按 Engine / TP Rank)": "Prefill Throughput (by Engine / TP Rank)",
    "Prefill 延迟 (按 Engine / TP Rank)": "Prefill Latency (by Engine / TP Rank)",
    "平均队列时间 (按 Engine / TP Rank)": "Average Queue Time (by Engine / TP Rank)",
    "SGLang / vLLM 指标监控": "SGLang / vLLM Metrics Dashboard"
}

def translate_recursive(obj):
    if isinstance(obj, dict):
        for k, v in obj.items():
            if isinstance(v, str):
                for zh, en in translations.items():
                    if zh in v:
                        v = v.replace(zh, en)
                obj[k] = v
            else:
                translate_recursive(v)
    elif isinstance(obj, list):
        for i, v in enumerate(obj):
            if isinstance(v, str):
                for zh, en in translations.items():
                    if zh in v:
                        v = v.replace(zh, en)
                obj[i] = v
            else:
                translate_recursive(v)

translate_recursive(dash)

dash["id"] = None
dash["uid"] = "llm-inference-dashboard"
dash["title"] = "SGLang / vLLM Metrics Dashboard"

# Ensure the datasource uses Prometheus
def update_datasource(obj):
    if isinstance(obj, dict):
        if "datasource" in obj and isinstance(obj["datasource"], dict):
            if obj["datasource"].get("type") == "prometheus":
                obj["datasource"]["uid"] = "${DS_PROMETHEUS}"
        for k, v in obj.items():
            update_datasource(v)
    elif isinstance(obj, list):
        for item in obj:
            update_datasource(item)

update_datasource(dash)

with open("grafana/dashboards/llm_inference.json", "w") as f:
    json.dump(dash, f, indent=2)

print("Dashboard translated and saved.")
