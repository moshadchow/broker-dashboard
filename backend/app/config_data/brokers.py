# Keep in sync with src/config/brokers.ts
#
# "endpoint" selects which OMS API (see Settings.oms_endpoints) this broker's
# data is fetched from: "primary" (default), "secondary", or "puji". FCS is
# routed to "puji" since its dedicated credentials (fcs_xfl_broker_trade_api)
# are scoped to that endpoint.
BROKERS: list[dict[str, str]] = [
    {"id": "681caf09c0024a529d5a0fe4", "label": "SNM", "endpoint": "primary"},
    {"id": "681caf1cc0024a529d5a0ff1", "label": "BAL", "endpoint": "primary"},
    {"id": "681cae95c0024a529d5a0fb0", "label": "EBS", "endpoint": "primary"},
    {"id": "698482b3de47c112ec2675aa", "label": "FCS", "endpoint": "puji"},
    {"id": "681caf2dc0024a529d5a0ffe", "label": "GDF", "endpoint": "primary"},
    {"id": "698482c1de47c112ec2675c4", "label": "IBL", "endpoint": "primary"},
    {"id": "681caf3fc0024a529d5a100b", "label": "IBB", "endpoint": "primary"},
    {"id": "698482ccde47c112ec2675de", "label": "MPL", "endpoint": "primary"},
    {"id": "681caee7c0024a529d5a0fd7", "label": "NLS", "endpoint": "primary"},
    {"id": "681caeb1c0024a529d5a0fbd", "label": "ONE", "endpoint": "primary"},
    {"id": "6949489d43148d5124c5bffe", "label": "REM", "endpoint": "primary"},
    {"id": "681caec3c0024a529d5a0fca", "label": "SJB", "endpoint": "primary"},
    {"id": "6930211e371a2699f4df89f6", "label": "SKY", "endpoint": "primary"},
    {"id": "681cae5ec0024a529d5a0fa3", "label": "UBR", "endpoint": "primary"},
    {"id": "698482d6de47c112ec2675f8", "label": "WSL", "endpoint": "primary"},
]
