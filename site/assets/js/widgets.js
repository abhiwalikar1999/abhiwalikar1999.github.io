// Interactive explainers used on the project pages.
//  - [data-widget="loop"]: steps through the LangGraph self-check loop
//  - [data-widget="tree"]: evaluates the decision tree's six main rules
(() => {
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;

  // ---- LangGraph loop ------------------------------------------------------------
  // The control flow is extract -> critique -> (repair -> critique)* -> end, with a
  // cap of three repair rounds: worst case 1 + 1 + 3 * 2 = 8 LLM calls.
  const SCENARIOS = {
    clean: [
      { node: 'extract', call: true, msg: 'drafted a context model' },
      { node: 'critique', call: true, msg: 'no issues found', kind: 'ok' },
      { node: 'end', msg: 'return the validated model' },
    ],
    one: [
      { node: 'extract', call: true, msg: 'drafted a context model' },
      { node: 'critique', call: true, msg: 'issue: missing actor', kind: 'issue' },
      { node: 'repair', call: true, round: true, msg: 'add the missing actor' },
      { node: 'critique', call: true, msg: 'no issues found', kind: 'ok' },
      { node: 'end', msg: 'return the validated model' },
    ],
    cap: [
      { node: 'extract', call: true, msg: 'drafted a context model' },
      { node: 'critique', call: true, msg: 'issue: missing actor', kind: 'issue' },
      { node: 'repair', call: true, round: true, msg: 'repair round 1' },
      { node: 'critique', call: true, msg: 'issue: invented relationship', kind: 'issue' },
      { node: 'repair', call: true, round: true, msg: 'repair round 2' },
      { node: 'critique', call: true, msg: 'issue: contradiction', kind: 'issue' },
      { node: 'repair', call: true, round: true, msg: 'repair round 3' },
      { node: 'critique', call: true, msg: 'issue still reported', kind: 'issue' },
      { node: 'end', msg: 'round cap reached, stop' },
    ],
  };

  document.querySelectorAll('[data-widget="loop"]').forEach((root) => {
    const nodes = Object.fromEntries([...root.querySelectorAll('[data-node]')].map((n) => [n.dataset.node, n]));
    const log = root.querySelector('[data-log]');
    const callsEl = root.querySelector('[data-calls]');
    const roundsEl = root.querySelector('[data-rounds]');
    const runBtn = root.querySelector('[data-run]');
    const scenarioBtns = [...root.querySelectorAll('[data-scenario]')];
    let scenario = scenarioBtns.find((b) => b.getAttribute('aria-pressed') === 'true')?.dataset.scenario || 'one';
    let timer = null;

    const reset = () => {
      clearTimeout(timer);
      Object.values(nodes).forEach((n) => n.classList.remove('is-active', 'is-done'));
      log.replaceChildren();
      callsEl.textContent = '0';
      roundsEl.textContent = '0 / 3';
    };

    const show = (step, i, state) => {
      Object.values(nodes).forEach((n) => n.classList.remove('is-active'));
      const node = nodes[step.node];
      node.classList.add('is-active', 'is-done');
      if (step.call) state.calls += 1;
      if (step.round) state.rounds += 1;
      callsEl.textContent = String(state.calls);
      roundsEl.textContent = `${state.rounds} / 3`;

      const li = document.createElement('li');
      if (step.kind) li.className = step.kind;
      const t = document.createElement('span');
      t.className = 't';
      t.textContent = String(i + 1).padStart(2, '0');
      const name = document.createElement('span');
      name.textContent = `${step.node} → `;
      const msg = document.createElement('span');
      msg.className = 'msg';
      msg.textContent = step.call ? `${step.msg}  (call ${state.calls})` : step.msg;
      li.append(t, name, msg);
      log.appendChild(li);
      log.scrollTop = log.scrollHeight;
    };

    const run = () => {
      reset();
      const steps = SCENARIOS[scenario];
      const state = { calls: 0, rounds: 0 };
      if (reducedMotion) {
        steps.forEach((step, i) => show(step, i, state));
        return;
      }
      runBtn.disabled = true;
      let i = 0;
      const tick = () => {
        show(steps[i], i, state);
        i += 1;
        if (i < steps.length) timer = setTimeout(tick, 650);
        else runBtn.disabled = false;
      };
      tick();
    };

    scenarioBtns.forEach((btn) => {
      btn.addEventListener('click', () => {
        scenario = btn.dataset.scenario;
        scenarioBtns.forEach((b) => b.setAttribute('aria-pressed', String(b === btn)));
        runBtn.disabled = false;
        run();
      });
    });
    runBtn.addEventListener('click', run);
  });

  // ---- Decision-tree explorer ------------------------------------------------------------
  // The six main rules of the tuned depth-5 tree (86.2% nested CV), checked top to bottom.
  const RULES = [
    { feature: 'semantic-web', reason: 'has the research topic semantic web', group: 'Knowledge Management' },
    { feature: 'schmeck', reason: 'co-authored with Hartmut Schmeck', group: 'Efficient Algorithms' },
    { feature: 'finance', reason: 'has the research topic computational finance', group: 'Complexity Management' },
    { feature: 'studer', reason: 'co-authored with Rudi Studer', group: 'Knowledge Management' },
    { feature: 'evolutionary', reason: 'has the research topic evolutionary algorithms', group: 'Efficient Algorithms' },
    { feature: null, reason: 'none of the conditions above holds', group: 'Business Information and Communication Systems' },
  ];

  document.querySelectorAll('[data-widget="tree"]').forEach((root) => {
    const inputs = [...root.querySelectorAll('input[data-feature]')];
    const rules = [...root.querySelectorAll('[data-rule]')];
    const groupEl = root.querySelector('[data-result-group]');
    const whyEl = root.querySelector('[data-result-why]');

    const update = () => {
      const on = new Set(inputs.filter((i) => i.checked).map((i) => i.dataset.feature));
      const hit = RULES.findIndex((r) => r.feature === null || on.has(r.feature));
      rules.forEach((el, i) => {
        el.classList.toggle('is-no', i < hit);
        el.classList.toggle('is-hit', i === hit);
        el.classList.toggle('is-skip', i > hit);
      });
      const rule = RULES[hit];
      const before = hit === 1 ? 'Rule 1 is "no"' : `Rules 1–${hit} are "no"`;
      groupEl.textContent = rule.group;
      whyEl.textContent = hit === 0
        ? `Rule 1 fires straight away: the researcher ${rule.reason}.`
        : rule.feature === null
          ? 'Rules 1–5 are all "no", so the tree falls through to its default leaf.'
          : `${before}, so rule ${hit + 1} fires because the researcher ${rule.reason}.`;
    };

    inputs.forEach((i) => i.addEventListener('change', update));
    update();
  });
})();
