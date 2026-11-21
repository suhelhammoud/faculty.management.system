export interface RemovalAssetOption {
  id: string;
  tag: string;
  name: string;
  status: string;
}

export interface ProposalLine {
  assetId: string;
  reason: string;
}

export interface RemovalRequest {
  currentRevision: number;
  instanceId: string;
  items: (ProposalLine & {
    tag: string;
    name: string;
    condition: string;
    revision: number;
    outcome: string | null;
    decisionReason: string | null;
  })[];
  decision: { name: string; reference: string; decidedOn: string } | null;
}
