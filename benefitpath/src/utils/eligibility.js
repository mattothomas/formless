// PA 2025-2026 Federal Poverty Level thresholds and eligibility rules

const SNAP_LIMITS = {
  1: 2878,
  2: 3893,
  3: 4909,
  4: 5926,
  extraPerPerson: 1017,
};

const WIC_LIMITS_PCT_FPL = 185; // 185% FPL
const FPL_BASE = {
  1: 1255,
  2: 1703,
  3: 2152,
  4: 2601,
  extraPerPerson: 449,
};

function getFPL(size) {
  const s = Math.max(1, size);
  if (s <= 4) return FPL_BASE[s];
  return FPL_BASE[4] + (s - 4) * FPL_BASE.extraPerPerson;
}

function getSNAPLimit(size) {
  const s = Math.max(1, size);
  if (s <= 4) return SNAP_LIMITS[s];
  return SNAP_LIMITS[4] + (s - 4) * SNAP_LIMITS.extraPerPerson;
}

export function calculateEligibility(extractedData) {
  const results = [];

  const householdSize = (extractedData.householdMembers?.length || 0) + 1; // +1 for applicant
  const totalMonthlyIncome = (extractedData.monthlyIncome || []).reduce((sum, inc) => {
    const amount = parseFloat(inc.amount) || 0;
    const freq = (inc.frequency || '').toLowerCase();
    if (freq === 'weekly') return sum + amount * 4.33;
    if (freq === 'biweekly') return sum + amount * 2.17;
    if (freq === 'annual' || freq === 'yearly') return sum + amount / 12;
    return sum + amount;
  }, 0);

  const fpl = getFPL(householdSize);
  const fplPct = totalMonthlyIncome > 0 ? (totalMonthlyIncome / fpl) * 100 : 0;

  // Determine if household has children under 5 or 18, pregnant women
  const members = extractedData.householdMembers || [];
  const hasChildUnder5 = members.some(m => {
    if (!m.dob) return false;
    const age = getAgeFromDOB(m.dob);
    return age !== null && age < 5;
  });
  const hasChildUnder18 = members.some(m => {
    if (!m.dob) return false;
    const age = getAgeFromDOB(m.dob);
    return age !== null && age < 18;
  });
  const isPregnant = extractedData.isPregnant || false;

  // --- SNAP ---
  const snapLimit = getSNAPLimit(householdSize);
  if (totalMonthlyIncome === 0) {
    results.push({
      program: 'SNAP',
      programName: 'Food Assistance (SNAP)',
      eligible: 'maybe',
      confidence: 60,
      reason: `We need your income information to determine SNAP eligibility. The limit for a household of ${householdSize} is $${snapLimit.toLocaleString()}/month.`,
      icon: '🍎',
    });
  } else if (totalMonthlyIncome <= snapLimit) {
    const pct = Math.round((totalMonthlyIncome / snapLimit) * 100);
    results.push({
      program: 'SNAP',
      programName: 'Food Assistance (SNAP)',
      eligible: 'yes',
      confidence: pct < 80 ? 92 : 78,
      reason: `Your estimated income of $${Math.round(totalMonthlyIncome).toLocaleString()}/month is within the PA SNAP limit of $${snapLimit.toLocaleString()}/month for a household of ${householdSize}. You likely qualify.`,
      icon: '🍎',
    });
  } else {
    results.push({
      program: 'SNAP',
      programName: 'Food Assistance (SNAP)',
      eligible: 'no',
      confidence: 80,
      reason: `Your income appears to exceed the SNAP limit of $${snapLimit.toLocaleString()}/month for a household of ${householdSize}. You may still qualify with deductions — apply to find out.`,
      icon: '🍎',
    });
  }

  // --- Medicaid / CHIP ---
  const medicaidLimit138 = Math.round(fpl * 1.38);
  if (totalMonthlyIncome === 0) {
    results.push({
      program: 'Medicaid',
      programName: 'Medicaid / CHIP',
      eligible: 'maybe',
      confidence: 55,
      reason: 'Share your income and we can check Medicaid eligibility (138% FPL for adults, higher for children).',
      icon: '🏥',
    });
  } else if (totalMonthlyIncome <= medicaidLimit138) {
    results.push({
      program: 'Medicaid',
      programName: 'Medicaid / CHIP',
      eligible: 'yes',
      confidence: 90,
      reason: `Your income is at or below 138% of the Federal Poverty Level ($${medicaidLimit138.toLocaleString()}/month). You likely qualify for Medicaid.`,
      icon: '🏥',
    });
  } else if (hasChildUnder18) {
    results.push({
      program: 'Medicaid',
      programName: 'Medicaid / CHIP',
      eligible: 'maybe',
      confidence: 70,
      reason: `Your income may be above the Medicaid adult threshold, but children in your household may qualify for CHIP at higher income limits. Apply to check.`,
      icon: '🏥',
    });
  } else {
    results.push({
      program: 'Medicaid',
      programName: 'Medicaid / CHIP',
      eligible: 'no',
      confidence: 65,
      reason: `Your income appears above the Medicaid limit of $${medicaidLimit138.toLocaleString()}/month. You may qualify for marketplace insurance with subsidies.`,
      icon: '🏥',
    });
  }

  // --- TANF ---
  if (hasChildUnder18) {
    const tanfLimit = Math.round(fpl * 0.5); // rough PA TANF threshold
    if (totalMonthlyIncome === 0 || totalMonthlyIncome <= tanfLimit) {
      results.push({
        program: 'TANF',
        programName: 'Cash Assistance (TANF)',
        eligible: 'maybe',
        confidence: 65,
        reason: 'You have children under 18 and may qualify for monthly cash assistance through TANF. Eligibility depends on assets, work requirements, and citizenship — apply to find out.',
        icon: '💵',
      });
    } else {
      results.push({
        program: 'TANF',
        programName: 'Cash Assistance (TANF)',
        eligible: 'no',
        confidence: 60,
        reason: 'Your income may be above TANF thresholds, but other factors like assets and family composition matter. It\'s still worth applying.',
        icon: '💵',
      });
    }
  } else {
    results.push({
      program: 'TANF',
      programName: 'Cash Assistance (TANF)',
      eligible: 'no',
      confidence: 85,
      reason: 'TANF is for families with children under 18. Based on your household, you do not appear to be eligible.',
      icon: '💵',
    });
  }

  // --- LIHEAP ---
  const liheapLimit60Pct = Math.round(fpl * (60 / 100) * (54590 / 15060)); // ~60% state median (~$54,590 for family of 4)
  // Simplified: roughly 200% FPL as LIHEAP proxy
  const liheapLimit = Math.round(fpl * 2.0);
  const liheapExpires = 'May 8, 2026';
  if (totalMonthlyIncome === 0 || totalMonthlyIncome <= liheapLimit) {
    results.push({
      program: 'LIHEAP',
      programName: 'Heating Bill Help (LIHEAP)',
      eligible: 'yes',
      confidence: 80,
      reason: `LIHEAP is open NOW through ${liheapExpires}. It can pay $200–$1,000 toward your heating bill. Based on your income, you likely qualify. Apply immediately — funds run out!`,
      icon: '🔥',
      urgent: true,
    });
  } else {
    results.push({
      program: 'LIHEAP',
      programName: 'Heating Bill Help (LIHEAP)',
      eligible: 'maybe',
      confidence: 50,
      reason: `LIHEAP eligibility is based on 60% of state median income. Apply by ${liheapExpires} to find out — funds are limited.`,
      icon: '🔥',
      urgent: true,
    });
  }

  // --- WIC ---
  const wicLimit185 = Math.round(fpl * 1.85);
  const alreadyOnSnap = results.find(r => r.program === 'SNAP' && r.eligible === 'yes');
  const wicEligible = isPregnant || hasChildUnder5 || extractedData.isPostpartum || extractedData.isBreastfeeding;

  if (wicEligible) {
    if (alreadyOnSnap || totalMonthlyIncome === 0 || totalMonthlyIncome <= wicLimit185) {
      results.push({
        program: 'WIC',
        programName: 'WIC (Women, Infants & Children)',
        eligible: 'yes',
        confidence: 88,
        reason: alreadyOnSnap
          ? 'Since you qualify for SNAP, the WIC income test is waived. You qualify if you have a child under 5 or are pregnant/postpartum.'
          : `Your income is within 185% FPL ($${wicLimit185.toLocaleString()}/month). You qualify for WIC nutrition benefits.`,
        icon: '👶',
      });
    } else {
      results.push({
        program: 'WIC',
        programName: 'WIC (Women, Infants & Children)',
        eligible: 'maybe',
        confidence: 55,
        reason: `WIC serves pregnant/postpartum women and children under 5 with income under 185% FPL ($${wicLimit185.toLocaleString()}/month). Apply to confirm.`,
        icon: '👶',
      });
    }
  } else if (hasChildUnder5) {
    results.push({
      program: 'WIC',
      programName: 'WIC (Women, Infants & Children)',
      eligible: 'maybe',
      confidence: 65,
      reason: 'You have a child under 5, which may qualify your household for WIC. Eligibility also includes the child\'s nutritional risk assessment.',
      icon: '👶',
    });
  } else {
    results.push({
      program: 'WIC',
      programName: 'WIC (Women, Infants & Children)',
      eligible: 'no',
      confidence: 75,
      reason: 'WIC serves pregnant/postpartum/breastfeeding women and children under 5. Based on your household info, you do not appear to qualify.',
      icon: '👶',
    });
  }

  return results;
}

function getAgeFromDOB(dob) {
  if (!dob) return null;
  try {
    const birth = new Date(dob);
    if (isNaN(birth.getTime())) return null;
    const now = new Date();
    let age = now.getFullYear() - birth.getFullYear();
    const m = now.getMonth() - birth.getMonth();
    if (m < 0 || (m === 0 && now.getDate() < birth.getDate())) age--;
    return age;
  } catch {
    return null;
  }
}
