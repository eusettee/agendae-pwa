const test = require('node:test');
const assert = require('node:assert/strict');
const { triage } = require('../lib/triage.cjs');
const input = { symptoms: 'Dor persistente no joelho ao caminhar', duration: 'há dois dias', intensity: 'leve', consent: true };
test('pré-triagem exige consentimento e alerta urgência sem chamar IA', async () => {
  await assert.rejects(() => triage({ ...input, consent: false }), /autorize/);
  const result = await triage({ ...input, symptoms: 'Estou sentindo dor no peito e falta de ar' }, () => { throw new Error('Não deve chamar a IA'); });
  assert.equal(result.urgent, true); assert.equal(result.specialty, null); assert.equal(result.source, 'safety');
});
test('sem chave não apresenta regras como IA', async () => {
  delete process.env.OPENAI_API_KEY;
  assert.equal((await triage(input)).source, 'manual');
});
test('IA recebe dados mínimos, valida saída e tem alternativa em falhas', async () => {
  process.env.OPENAI_API_KEY = 'test-only';
  const mock = async (url, options) => {
    assert.equal(url, 'https://api.openai.com/v1/responses');
    const payload = JSON.parse(options.body);
    assert.equal(payload.store, false); assert.equal(payload.text.format.strict, true);
    assert.deepEqual(Object.keys(JSON.parse(payload.input)).sort(), ['duration', 'intensity', 'symptoms']);
    return { ok: true, json: async () => ({ status: 'completed', output: [{ content: [{ type: 'output_text', text: JSON.stringify({ specialty: 'Ortopedia', confidence: 'moderada', urgent: false }) }] }] }) };
  };
  const result = await triage(input, mock);
  assert.equal(result.source, 'ai'); assert.equal(result.specialty, 'Ortopedia');
  const refused = await triage(input, async () => ({ ok: true, json: async () => ({ status: 'completed', output: [{ content: [{ type: 'refusal' }] }] }) }));
  assert.equal(refused.source, 'manual');
  const failed = await triage(input, async () => { throw new Error('timeout'); });
  assert.equal(failed.source, 'manual');
  delete process.env.OPENAI_API_KEY;
});
