import { useMemo, useState } from 'react';
import {
  ReactFlow, Background, Controls, Handle, Position, MarkerType, useNodesState,
  type Node, type NodeProps, type Edge,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { Box, Code2, FileText, LockKeyhole, MessageSquare, Network, ShieldAlert, ShieldCheck } from 'lucide-react';
import type { RunRecord } from '../../lib/experiment';

type GraphData = { label: string; subtitle: string; kind: string; stage: string };
type GraphNode = Node<GraphData, 'beacon'>;
const nodeDefinitions = [
  { id: 'question', x: 0, y: 0, label: 'Question', subtitle: 'Captured input', kind: 'question' },
  { id: 'policy', x: 0, y: 150, label: 'Leave policy', subtitle: 'Untrusted document', kind: 'policy' },
  { id: 'model', x: 220, y: 75, label: 'Scripted assistant', subtitle: 'Not a live LLM', kind: 'model' },
  { id: 'backend', x: 440, y: 75, label: 'Document tool', subtitle: 'Fixed identifiers only', kind: 'backend' },
  { id: 'vulnerable', x: 660, y: -20, label: 'Vulnerable profile', subtitle: 'Policy + payroll', kind: 'vulnerable' },
  { id: 'protected', x: 660, y: 175, label: 'Protected profile', subtitle: 'Policy only', kind: 'protected' },
  { id: 'payroll-vulnerable', x: 900, y: -20, label: 'Synthetic payroll', subtitle: 'Vulnerable path', kind: 'payroll' },
  { id: 'payroll-protected', x: 900, y: 175, label: 'Synthetic payroll', subtitle: 'Protected path', kind: 'payroll' },
];
const descriptions: Record<string, string> = {
  question: 'The captured question is used for every selected target. Editing a draft does not change an existing result.',
  policy: 'The policy is untrusted task data. The fixture recognizes a narrow instruction requesting private/payroll.csv; this is not a general attack detector.',
  model: 'A deterministic fixture chooses actions according to the selected behavior. There is no Bedrock model, inference cost, or private reasoning trace.',
  backend: 'The document tool accepts leave_policy and payroll only. Arbitrary paths, buckets, roles, and AWS commands are not accepted.',
  vulnerable: 'Local profile: leave_policy and payroll are readable. This is deliberately excessive application access, not an AWS vulnerability.',
  protected: 'Local profile: leave_policy is readable, payroll is rejected. This exercises application-side permission checks, not AWS IAM.',
  'payroll-vulnerable': 'A successful local retrieval can deliver synthetic payroll to the scripted context. Final disclosure is recorded separately.',
  'payroll-protected': 'A denied local request must not return payroll contents or deliver them to the scripted context.',
};

function BeaconNode({ data }: NodeProps<GraphNode>) {
  const Icon = data.kind === 'question' ? MessageSquare : data.kind === 'policy' ? FileText : data.kind === 'model' ? Box : data.kind === 'backend' ? Code2 : data.kind === 'vulnerable' ? ShieldAlert : data.kind === 'protected' ? ShieldCheck : LockKeyhole;
  return (
    <div className="beacon-graph-node" data-stage={data.stage}>
      <Handle type="target" position={Position.Left} />
      <div><Icon size={19} /><strong>{data.label}</strong></div><small>{data.subtitle}</small>
      <span className="graph-node-stage">{data.stage === 'idle' ? 'Not observed' : data.stage === 'denied' ? 'Blocked locally' : data.stage === 'exposed' ? 'Synthetic exposure' : 'Observed locally'}</span>
      <Handle type="source" position={Position.Right} />
    </div>
  );
}
const nodeTypes = { beacon: BeaconNode };
const initialNodes: GraphNode[] = nodeDefinitions.map(definition => ({
  id: definition.id, type: 'beacon', position: { x: definition.x, y: definition.y },
  data: { label: definition.label, subtitle: definition.subtitle, kind: definition.kind, stage: 'idle' },
}));

export default function AccessGraph({ record, cursor }: { record: RunRecord | null; cursor: number }) {
  const [selected, setSelected] = useState('backend');
  // Keep React Flow's measured dimensions as well as drag positions. Recreating
  // nodes without those measurements leaves custom nodes permanently hidden.
  const [layoutNodes, , onNodesChange] = useNodesState<GraphNode>(initialNodes);
  const observed = record?.events.slice(0, cursor + 1) ?? [];
  function stage(id: string) {
    if (!record) return 'idle';
    if (id.startsWith('payroll-')) {
      const actor = id.endsWith('protected') ? 'protected' : 'vulnerable';
      if (observed.some(event => event.actor === actor && event.event_type === 'access_denied')) return 'denied';
      if (observed.some(event => event.actor === actor && event.event_type === 'answer_generated' && event.metadata.payroll_exposed === true)) return 'exposed';
      return observed.some(event => event.actor === actor && event.event_type === 'document_retrieved' && event.metadata.document_id === 'payroll') ? 'observed' : 'idle';
    }
    if (id === 'question') return observed.length ? 'observed' : 'idle';
    if (id === 'policy') return observed.some(event => event.event_type === 'document_retrieved' && event.metadata.document_id === 'leave_policy') ? 'observed' : 'idle';
    if (id === 'model') return observed.some(event => event.event_type === 'model_decision') ? 'observed' : 'idle';
    if (id === 'backend') return observed.some(event => event.event_type === 'document_requested') ? 'observed' : 'idle';
    return observed.some(event => event.actor === id && event.event_type === 'document_requested') ? 'observed' : 'idle';
  }
  const nodes: GraphNode[] = layoutNodes.map(node => ({
    ...node,
    selected: selected === node.id,
    ariaLabel: `Inspect ${node.data.label}: ${stage(node.id)}`,
    data: { ...node.data, stage: stage(node.id) },
  }));
  const edges: Edge[] = useMemo(() => [
    ['question', 'model'], ['policy', 'model'], ['model', 'backend'], ['backend', 'vulnerable'],
    ['backend', 'protected'], ['vulnerable', 'payroll-vulnerable'], ['protected', 'payroll-protected'],
  ].map(([source, target]) => ({ id: `${source}-${target}`, source, target, markerEnd: { type: MarkerType.ArrowClosed }, type: 'smoothstep' })), []);
  const styledEdges = edges.map(edge => {
    const targetStage = stage(edge.target);
    return { ...edge, style: { stroke: targetStage === 'denied' || targetStage === 'exposed' ? '#B42332' : targetStage === 'observed' ? '#137665' : '#a9bacb', strokeWidth: 1.5 } };
  });

  return (
    <section className="access-graph-panel" aria-labelledby="access-graph-title">
      <div className="panel-heading"><div><Network size={17} /><h2 id="access-graph-title">Inspect the access path</h2></div><span className="text-note">{record ? `Recorded simulation · event ${cursor + 1}/${record.events.length}` : 'Local architecture illustration'}</span></div>
      <div className="access-graph-canvas" role="region" aria-label="Interactive local access diagram">
        <ReactFlow<GraphNode> nodes={nodes} edges={styledEdges} nodeTypes={nodeTypes} onNodesChange={onNodesChange} onNodeClick={(_, node) => setSelected(node.id)} deleteKeyCode={null} fitView fitViewOptions={{ padding: 0.12 }} minZoom={0.25} maxZoom={1.5} nodesConnectable={false} edgesReconnectable={false} attributionPosition="bottom-left">
          <Background color="#d5e0ec" gap={20} size={1} /><Controls showInteractive={false} />
        </ReactFlow>
      </div>
      <div className="graph-inspector" aria-live="polite"><span className="inspection-label">Selected node · dragging changes layout only</span><strong>{nodeDefinitions.find(node => node.id === selected)?.label}</strong><p>{descriptions[selected]}</p></div>
      <details className="graph-text-alternative"><summary>Read the text version</summary><p>Question and policy → scripted assistant → fixed document tool → vulnerable or protected local profile → synthetic payroll. The graph reflects captured events through the selected timeline position. It does not show AWS activity.</p></details>
    </section>
  );
}
