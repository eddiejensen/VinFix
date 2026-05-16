function normalizeText(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function asArray(value) {
  if (Array.isArray(value)) {
    return value;
  }
  if (typeof value === 'string' && value.trim()) {
    return value
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean);
  }
  return [];
}

function parseYear(value) {
  const year = Number.parseInt(String(value || ''), 10);
  return Number.isFinite(year) ? year : null;
}

function yearMatches(vehicle, issue) {
  const year = parseYear(vehicle?.year);
  if (!year || issue.yearStart == null || issue.yearEnd == null) {
    return false;
  }
  return year >= Number(issue.yearStart) && year <= Number(issue.yearEnd);
}

function vehicleMatches(vehicle, issue) {
  const make = normalizeText(vehicle?.make);
  const model = normalizeText(vehicle?.model);
  const issueMake = normalizeText(issue?.make);
  const issueModel = normalizeText(issue?.model);

  return Boolean(
    make &&
      model &&
      issueMake &&
      issueModel &&
      make === issueMake &&
      (model === issueModel || model.includes(issueModel) || issueModel.includes(model)) &&
      yearMatches(vehicle, issue)
  );
}

const GM_FULLSIZE = [
  ['chevrolet', 'suburban'],
  ['chevrolet', 'tahoe'],
  ['chevrolet', 'silverado 1500'],
  ['gmc', 'yukon'],
  ['gmc', 'sierra 1500'],
];

function isGmFullsize(make, model) {
  const normalizedMake = normalizeText(make);
  const normalizedModel = normalizeText(model);
  return GM_FULLSIZE.some(
    ([entryMake, entryModel]) =>
      normalizedMake === entryMake &&
      (normalizedModel === entryModel ||
        normalizedModel.includes(entryModel) ||
        entryModel.includes(normalizedModel))
  );
}

function platformMatches(vehicle, issue) {
  return (
    isGmFullsize(vehicle?.make, vehicle?.model) &&
    isGmFullsize(issue?.make, issue?.model) &&
    yearMatches(vehicle, issue) &&
    !vehicleMatches(vehicle, issue)
  );
}

function includesAny(text, terms) {
  const haystack = normalizeText(text);
  return asArray(terms).some((term) => {
    const normalized = normalizeText(term);
    return normalized && haystack.includes(normalized);
  });
}

function extractCodes(...values) {
  return values
    .flatMap((value) => String(value || '').match(/[pcbu][0-9]{4}/gi) || [])
    .map((code) => code.toUpperCase());
}

function confidenceForScore(score) {
  if (score >= 80) return 'high';
  if (score >= 50) return 'medium';
  return 'low';
}

function addCandidate(candidates, cause, source = {}) {
  const normalizedCause = normalizeText(cause);
  if (!normalizedCause) {
    return null;
  }

  if (!candidates.has(normalizedCause)) {
    candidates.set(normalizedCause, {
      cause: String(cause).trim(),
      score: 0,
      reasons: [],
      relatedCodes: new Set(),
      relatedCommonIssues: [],
      suggestedFlowId: source.relatedFlowId || source.flowId || '',
      source,
    });
  }

  return candidates.get(normalizedCause);
}

function scoreDiagnosticSuggestions({
  vehicle = {},
  flow = {},
  symptoms = '',
  codes = [],
  answers = [],
  commonIssues = [],
  repairHistory = [],
  confirmedFixes = [],
} = {}) {
  const candidates = new Map();
  const codeList = [...new Set([...asArray(codes), ...extractCodes(symptoms)].map((code) => code.toUpperCase()))];
  const symptomText = normalizeText(symptoms);
  const flowTerms = [
    flow?.id,
    flow?.title,
    ...(flow?.aliases || []),
    ...(flow?.symptoms || []),
    ...(flow?.symptomKeywords || []),
    ...(flow?.commonIssueKeywords || []),
    ...(flow?.relatedCodes || []),
  ];

  commonIssues.forEach((issue) => {
    const candidate = addCandidate(candidates, issue.issue, {
      relatedIssueId: issue.id,
      relatedFlowId: (issue.relatedFlowIds || [])[0] || flow?.id || '',
    });
    if (!candidate) return;

    candidate.relatedCommonIssues.push(issue);
    extractCodes(issue.symptomTrigger, issue.issue, issue.commonFix).forEach((code) =>
      candidate.relatedCodes.add(code)
    );
  });

  confirmedFixes.forEach((fix) => {
    addCandidate(candidates, fix.confirmed_fix || fix.confirmedFix || fix.part_replaced || fix.partReplaced, {
      flowId: fix.flow_id || fix.flowId || flow?.id || '',
    });
  });

  repairHistory.forEach((entry) => {
    addCandidate(candidates, entry.suspected_cause || entry.suspectedCause || entry.repair_performed || entry.repairPerformed, {
      flowId: flow?.id || '',
    });
  });

  if (flow?.nodes) {
    Object.values(flow.nodes).forEach((node) => {
      if (node?.result) {
        addCandidate(candidates, node.title, { flowId: flow.id || '' });
      }
    });
  }

  candidates.forEach((candidate) => {
    const causeText = normalizeText(candidate.cause);
    const causeWords = causeText.split(' ').filter((word) => word.length > 3);
    let matchesSymptomOrCode = false;

    candidate.relatedCommonIssues.forEach((issue) => {
      const issueText = [issue.issue, issue.symptomTrigger, issue.commonFix, ...(issue.keywords || [])].join(' ');

      if (vehicleMatches(vehicle, issue) || issue.matchType === 'exact') {
        candidate.score += 35;
        candidate.reasons.push('Exact year, make, and model common issue match (+35).');
      } else if (platformMatches(vehicle, issue) || issue.matchType === 'platform') {
        candidate.score += 15;
        candidate.reasons.push('Related platform issue seen on similar vehicles (+15).');
      }

      if (symptomText && includesAny(issueText, [symptomText, ...symptomText.split(' ')])) {
        candidate.score += 25;
        matchesSymptomOrCode = true;
        candidate.reasons.push('Symptom trigger matches your description or flow answers (+25).');
      }

      if (codeList.length > 0 && includesAny(issueText, codeList)) {
        candidate.score += 30;
        matchesSymptomOrCode = true;
        codeList.forEach((code) => {
          if (includesAny(issueText, [code])) candidate.relatedCodes.add(code);
        });
        candidate.reasons.push('Related OBD2 code appears in the common issue data (+30).');
      }

      if (
        issue.relatedFlowIds?.includes(flow?.id) ||
        issue.relatedFlowIds?.some((id) => (flow?.aliases || []).includes(id)) ||
        includesAny(issueText, flowTerms)
      ) {
        candidate.score += 20;
        candidate.suggestedFlowId = flow?.id || candidate.suggestedFlowId;
        candidate.reasons.push('Diagnostic flow points toward this type of cause (+20).');
      }
    });

    asArray(answers).forEach((entry) => {
      const answer = normalizeText(entry.answer);
      const answerText = normalizeText([entry.question, entry.answer].join(' '));
      const answerMentionsCause =
        includesAny(answerText, [candidate.cause]) || causeWords.some((word) => answerText.includes(word));

      if (answer === 'yes' && answerMentionsCause) {
        candidate.score += 20;
        candidate.reasons.push('A yes answer points toward this cause (+20).');
      }

      if (answer === 'no' && answerMentionsCause) {
        candidate.score -= 20;
        candidate.reasons.push('A no answer makes this cause less likely (-20).');
      }
    });

    confirmedFixes.forEach((fix) => {
      const fixedProblem =
        fix.did_fix_problem === true ||
        normalizeText(fix.did_fix_problem || fix.didFixProblem).includes('yes');
      const fixText = normalizeText([fix.confirmed_fix, fix.confirmedFix, fix.part_replaced, fix.partReplaced].join(' '));
      if (!fixedProblem || !includesAny(fixText, [candidate.cause, ...causeWords])) {
        return;
      }

      const fixVehicle = {
        year: fix.year,
        make: fix.make,
        model: fix.model,
      };

      if (
        normalizeText(fixVehicle.make) === normalizeText(vehicle.make) &&
        normalizeText(fixVehicle.model) === normalizeText(vehicle.model) &&
        parseYear(fixVehicle.year) === parseYear(vehicle.year)
      ) {
        candidate.score += 25;
        candidate.reasons.push('Confirmed fix history for the same year, make, and model (+25).');
      } else if (
        isGmFullsize(fixVehicle.make, fixVehicle.model) &&
        isGmFullsize(vehicle.make, vehicle.model)
      ) {
        candidate.score += 10;
        candidate.reasons.push('Confirmed fix history on a related platform (+10).');
      }
    });

    repairHistory.forEach((entry) => {
      const repairText = normalizeText([entry.parts_used, entry.partsUsed, entry.repair_performed, entry.repairPerformed].join(' '));
      if (includesAny(repairText, [candidate.cause, ...causeWords])) {
        candidate.score -= 15;
        candidate.reasons.push('A related part or repair already appears in recent history (-15).');
      }
    });

    if (!matchesSymptomOrCode && (symptomText || codeList.length > 0)) {
      candidate.score -= 10;
      candidate.reasons.push('No strong symptom or code match found (-10).');
    }
  });

  return [...candidates.values()]
    .map((candidate) => {
      const relatedCommonIssues = candidate.relatedCommonIssues.map((issue) => ({
        id: issue.id,
        issue: issue.issue,
        symptomTrigger: issue.symptomTrigger,
        commonFix: issue.commonFix,
        matchType: issue.matchType,
      }));
      const primaryIssue = relatedCommonIssues[0];

      return {
        cause: candidate.cause,
        score: Math.max(0, Math.round(candidate.score)),
        confidence: confidenceForScore(candidate.score),
        reason:
          candidate.reasons.length > 0
            ? `Recommendation based on symptoms, vehicle history, and common failures. ${candidate.reasons.join(' ')}`
            : 'Recommendation based on symptoms, vehicle history, and common failures.',
        nextBestTest: primaryIssue
          ? `Verify ${primaryIssue.issue} before replacing parts. Check for ${primaryIssue.symptomTrigger || 'matching symptoms'} and confirm with basic tests.`
          : 'Confirm the symptom, scan for codes, and test the most likely system before replacing parts.',
        relatedCodes: [...candidate.relatedCodes],
        relatedCommonIssues,
        suggestedFlowId: candidate.suggestedFlowId || flow?.id || '',
        relatedIssueId: primaryIssue?.id || null,
      };
    })
    .sort((a, b) => b.score - a.score);
}

module.exports = {
  scoreDiagnosticSuggestions,
  normalizeText,
};
