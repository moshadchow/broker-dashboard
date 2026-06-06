export interface Broker {
  id: string;    // sent as X-BrokerId request header
  label: string; // display name in table and chart
}

export const BROKERS: Broker[] = [
  { id: "681caf09c0024a529d5a0fe4", label: "SNM" },
  { id: "681caf1cc0024a529d5a0ff1", label: "BAL" },
  { id: "681cae95c0024a529d5a0fb0", label: "EBS" },
  { id: "698482b3de47c112ec2675aa", label: "FCS" },
  { id: "681caf2dc0024a529d5a0ffe", label: "GDF" },
  { id: "698482c1de47c112ec2675c4", label: "IBL" },
  { id: "681caf3fc0024a529d5a100b", label: "IBB" },
  { id: "698482ccde47c112ec2675de", label: "MPL" },
  { id: "681caee7c0024a529d5a0fd7", label: "NLS" },
  { id: "681caeb1c0024a529d5a0fbd", label: "ONE" },
  { id: "6949489d43148d5124c5bffe", label: "REM" },
  { id: "681caec3c0024a529d5a0fca", label: "SJB" },
  { id: "6930211e371a2699f4df89f6", label: "SKY" },
  { id: "681cae5ec0024a529d5a0fa3", label: "UBR" },
  { id: "698482d6de47c112ec2675f8", label: "WSL" },
];
