const text = { type: 'string' };
const ref = (name: string) => ({ $ref: `#/$defs/${name}` });
const array = (items: object) => ({ type: 'array', items });
const object = (properties: Record<string, object>, required = Object.keys(properties)) => ({ type: 'object', additionalProperties: false, required, properties });
const nullable = (schema: object) => ({ anyOf: [schema, { type: 'null' }] });
const confirmation = { enum: ['CONFIRMED', 'NOT_FOUND_IN_SCOPE', 'UNKNOWN', 'NOT_APPLICABLE'] };
export const reportSchema = {
  $schema: 'http://json-schema.org/draft-07/schema#',
  ...object({
    schemaVersion: { const: 'TokenTechnicalReview1.0' }, startedAt: text, finishedAt: text,
    execution: { enum: ['COMPLETED', 'PARTIAL'] },
    config: object({ schemaVersion: { const: 'TokenReviewConfig1.0' },
      network: object({ chainId: text, blockNumber: text }, ['chainId']),
      token: object({ address: text, label: text }, ['address']), dependencies: array(text),
      probes: array(object({ id: text, address: text, signature: text, args: array({ anyOf: [text, { type: 'boolean' }] }) })),
    }, ['schemaVersion', 'network', 'token']),
    tools: object({ analyzer: text, rules: text, compiler: text, ai: { const: 'NOT_RUN' }, slither: { const: 'NOT_RUN' } }),
    block: object({ number: nullable(text), hash: nullable(text), consistency: { enum: ['UNKNOWN', 'HASH_PINNED_RECHECKED'] } }),
    contracts: array(object({ address: text, runtimeHash: text, evidenceRef: text })),
    proxy: nullable({ type: 'object', required: ['pattern', 'resolution', 'implementationAddress', 'limitations'], properties: {
      pattern: text, resolution: { enum: ['RESOLVED', 'UNRESOLVED'] }, implementationAddress: { type: 'object' }, limitations: array(text),
    } }),
    sources: array(object({ address: text, contract: text, inputEvidence: text,
      compilation: { enum: ['SUCCEEDED', 'FAILED', 'NOT_RUN'] }, compilerRequested: text, compilerUsed: text,
      binding: object({ confirmation, reason: text, runtimeHash: text, observedRuntimeHash: text }, ['confirmation', 'reason']),
      functions: array(ref('function')),
    })),
    audits: array(object({ evidenceRef: text, title: text, publisher: text, reference: nullable(text),
      declaredTarget: nullable(object({ version: text, commit: text, scope: array(text) }, [])),
      authenticity: { const: 'UNKNOWN' }, deploymentMapping: { const: 'UNKNOWN' } })),
    findings: array(object({ id: text, rule: text, scope: { enum: ['SOURCE', 'CHAIN', 'AUDIT', 'COVERAGE'] },
      categories: array({ enum: ['INTENDED_ADMIN_FUNCTION', 'NONSTANDARD_BEHAVIOR', 'VULNERABILITY_CANDIDATE', 'CURRENT_STATE'] }), confirmation,
      summary: text, evidenceRefs: { type: 'array', minItems: 1, items: text } })),
    failures: array(object({ stage: text, code: text, evidenceRefs: array(text) })),
    evidence: array(object({ id: text, provenance: { enum: ['DOCUMENTED', 'OBSERVED', 'INFERRED'] },
      observedAt: text, observedBlockOrSlot: text, kind: text, data: {} })),
    artifacts: array(object({ path: text, sha256: text, bytes: { type: 'integer', minimum: 0 }, kind: text })), limitations: array(text),
  }),
  $defs: {
    location: object({ file: text, line: { type: 'integer', minimum: 1 }, endLine: { type: 'integer', minimum: 1 },
      start: { type: 'integer', minimum: 0 }, length: { type: 'integer', minimum: 0 } }),
    function: object({ name: text, contract: text, visibility: text, mutability: text, location: ref('location'),
      selector: nullable(text), parameters: text, returnParameters: text, inherited: { type: 'boolean' },
      implemented: { type: 'boolean' }, evidenceRef: text,
      modifiers: array(object({ name: text, declaration: nullable(ref('location')), text, evidenceRef: nullable(text) })),
      calls: array(object({ expression: text, declaration: nullable(ref('location')) })),
      conditions: array(text), writes: array(text), returns: array(text), assembly: { type: 'boolean' },
    }),
  },
};
