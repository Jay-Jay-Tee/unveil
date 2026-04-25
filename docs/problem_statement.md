# Problem Statement - UnbiasedAI

## The Problem

Algorithmic bias is one of the most consequential and least visible failures in modern AI systems. Machine learning models used in hiring, loan approvals, healthcare triage, and criminal sentencing routinely produce systematically worse outcomes for women, racial minorities, older applicants, and other protected groups - not because of explicit discrimination, but because the training data and learned feature weights encode historical inequality.

The harm is concrete and measurable. Studies of hiring algorithms have shown that résumés with traditionally female names receive callback rates 30-40% lower than identical résumés with male names. COMPAS, a widely deployed recidivism prediction tool used by US courts, was found to misclassify Black defendants as high-risk at nearly twice the rate it misclassified white defendants. Credit scoring models trained on historical repayment data continue to penalize applicants from zip codes that correlate with race due to decades of redlining - even when race is explicitly excluded as an input feature.

**The core problem has three dimensions:**

**1. Bias is invisible at training time.** Engineers building models rarely audit the training data for distributional disparities before fitting. By the time a model is in production, the bias has been baked in and amplified through feedback loops.

**2. Bias hides behind proxy features.** Removing a protected attribute like race or gender from a model does not remove bias. Features like zip code, relationship status, occupation category, or years of experience encode protected attributes indirectly with high mutual information. A model trained without race but with zip code is still making race-correlated predictions.

**3. Non-technical stakeholders cannot interrogate model decisions.** Compliance officers, legal teams, HR leads, and regulators must understand and act on bias findings - but raw SHAP values, p-values, and disparate impact ratios are inaccessible without data science training. The gap between technical findings and actionable compliance decisions leaves organizations exposed.

## Who It Harms

- **Job applicants** whose applications are auto-screened by biased hiring models
- **Loan applicants** denied credit by models that encode historical lending discrimination
- **Patients** whose treatment priority is ranked by health risk models trained on historically underserved populations
- **Criminal defendants** whose sentences or bail conditions are influenced by biased recidivism prediction tools
- **Organizations** that deploy biased models unknowingly and face legal and reputational exposure

## The Legal Stakes

The **80% Rule** (or four-fifths rule), codified in the EEOC Uniform Guidelines on Employee Selection Procedures, defines disparate impact bias in employment: if the selection rate for a protected group is less than 80% of the rate for the highest-selected group, the process is presumptively discriminatory and legally actionable. The EU AI Act (2024) mandates bias auditing for high-risk AI systems in employment, credit, and public services. GDPR Article 22 restricts fully automated decisions that significantly affect individuals without human oversight.

Current tools available to organizations are either academic research libraries requiring significant ML expertise, or expensive enterprise auditing platforms unavailable to smaller organizations. There is no accessible, end-to-end bias auditing tool that covers both training data and model behavior in a single workflow readable by non-technical compliance teams.

## Why Automated Systems Perpetuate Bias

**Historical data encodes historical inequality.** A model trained to predict loan repayment on data from 1990-2010 learns that certain zip codes, employment types, and demographic proxies correlate with default - because those correlations existed in a world shaped by discriminatory lending practices. The model doesn't know this context. It finds the pattern and uses it.

**Proxy amplification.** Once a model learns a proxy relationship (e.g., occupation → gender), it can exploit it at scale across millions of decisions. A human loan officer might unconsciously favor male applicants in a fraction of their decisions; a deployed model applies that bias consistently to every application it scores.

**Feedback loops.** Biased models produce biased outcomes, which become training data for the next model generation. Without external auditing, bias compounds over time.

## What UnbiasedAI Does About It

UnbiasedAI provides a two-part automated fairness audit covering every known attack surface for algorithmic bias:

- **Part A - Dataset Bias Auditor**: Detects disparate impact, demographic parity gaps, and proxy column risk in training data before a model is built - when bias is cheapest to fix.
- **Part B - Model Behavior Analyzer**: Audits a trained model's actual decision-making via counterfactual probing and SHAP feature attribution - revealing what the model learned, not just what it was told to learn.
- **Gemini Compliance Report**: Converts technical findings into a plain-English audit narrative that any compliance officer can read, understand, and act on - without a data science background.

The system ties every finding to a concrete legal threshold (the 80% disparate impact rule), provides slice-level evidence (e.g., "Female applicants approved at 61% vs 83% for male - a 22-point gap"), and surfaces proxy features the model is using to discriminate indirectly even when protected attributes are excluded from training.
