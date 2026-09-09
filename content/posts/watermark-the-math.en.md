---
title: "The Math Behind Model Watermarking"
date: 2026-09-09
draft: false
tags: ["watermarking", "linear algebra", "SVD", "permutation invariance", "equations"]
categories: ["ML"]
summary: "The equations I actually used while measuring four ways to sign a model: why permutation preserves the function, the SVD that finds low-energy directions, why subtracting the mean hides a bug, the optimization that writes and reads bits, and how to predict the number of flipped decisions."
---

## Where this came from

[The previous post](/en/posts/watermark-invisible-or-durable/) gave the conclusions. A few of them
only make sense in equations — in particular **the bound I overshot by 4x** was invisible until
I split one expression into two terms. These are the ones I actually used.

Notation. A sentence goes through the encoder to a hidden representation `h ∈ R^d` (d=768);
the classifier weight is `W ∈ R^(C×d)` with C classes, and the logits are `z = W h`.
Every decision comes out of that one vector.

## Why permutation preserves the function
 A permutation matrix `P` is orthogonal, so
`PᵀP = I`, and an elementwise activation satisfies `σ(Pu) = P σ(u)`.

```
W_in  ← P W_in
b_in  ← P b_in
W_out ← W_out Pᵀ

W_out Pᵀ · σ(P W_in x + P b_in)
  = W_out Pᵀ P · σ(W_in x + b_in)
  = W_out σ(W_in x + b_in)          ← identical to the original
```

Bits come from the relative order of unit pairs. With `pos(u)` the slot of unit u after
permutation:

```
b_k = 1[ pos(a_k) < pos(b_k) ]
```

## Low-energy directions come from an SVD
 Stack n representations into `H ∈ R^(n×d)`
with mean `μ`:

```
H − 1μᵀ = U Σ Vᵀ,     Σ = diag(s₁ ≥ … ≥ s_d)
energy share of direction i = s_i² / Σⱼ sⱼ²
```

Measured: the top 10 directions hold 77.62%, the bottom 120 hold 0.030%. One trap here —
`rank(H − 1μᵀ) ≤ min(n,d) − 1`, so **the last singular value is structurally zero.**
I measured `s₇₆₈ = 1.16e-05` against `s₇₆₇ = 0.146`, a factor of 12,562. Quoting
`s₁/s₇₆₈` gives an inflated ratio of 2.2×10⁷; the real spread is `s₁/s₇₆₇ = 1,814`.

## Confining the change to that subspace
 With `V_low ∈ R^(d×m)` holding the bottom m directions:

```
ΔW = A V_lowᵀ,        A ∈ R^(C×m)      degrees of freedom = C·m
Δz(h) = ΔW h = A (V_lowᵀ h)
```

The bracket is "how much this sentence loads on those directions" — near zero, so the logits
barely move.

## Subtracting the mean hides the bias shift
 Split the same expression into mean and deviation:

```
Δz(h) = A V_lowᵀ μ        ← common to every sentence (effectively a bias shift)
      + A V_lowᵀ (h − μ)  ← the part that varies per sentence
```

If you bound the change using **centered** H, the first term drops out of the computation.
A build I believed was within a 1e-4 bound was actually 4x over it. This is exactly why the
continual-learning literature uses the **uncentered** feature covariance. Measured, the
varying part shrinks 111x in the low-energy directions while the constant part shrinks only 6.6x.

## Magnitude cap
 Bound the sample max logit change by δ, then apply a scale s.

```
κ = min(1, δ / maxᵢ |Δz(hᵢ)|)
ΔW ← κ · s · ΔW
```

## Writing and reading bits
 With a secret matrix `X ∈ R^(B×Cm)`, target bits `bₖ`, and
signs `σₖ = 2bₖ − 1`:

```
embed: min_A  Σₖ softplus(1 − σₖ ⟨Xₖ, vec(A)⟩) + λ‖A‖²
read:  b̂ₖ = 1[ ⟨Xₖ, vec(A)⟩ > 0 ],   A = (W − W₀) V_low
```

The sign-based scheme reads `b̂ₖ = 1[⟨Xₖ, vec(W)⟩ > 0]` directly, so **it needs no reference
model.** The low-energy scheme needs `W₀`, and the permutation scheme needs the full original
to recover the ordering.

## Back to characters
 A 36-symbol alphabet gives 6 bits per character; majority vote over
r repetitions:

```
b̃ⱼ = 1[ Σ_{t<r} b̂_{j+tL} ≥ ⌊r/2⌋+1 ]
c   = ALPHA[ Σ_{i<6} b̃_{6j+i} · 2^(5−i) ]
```

## Signal to noise
 How much the read value moves under a quantizer `Q`:

```
signal = medianₖ |⟨Xₖ, vec(A)⟩|
noise  = meanₖ   |⟨Xₖ, vec(A_q − A)⟩|,   A_q = (Q(W) − W₀) V_low
```

At scale 1 this was `0.0015` against `0.0467` — the signal 31x below the noise. Scaling the
push by 100 moves S/N from 0.03 to 3.3, which is enough to survive int4.

## Predicting the flips
 Let ρ be the density of sentences near the threshold (sentences per unit
of score):

```
E[flips] ≈ maxᵢ |Δpᵢ| × ρ
```

Sixteen sentences out of two million sat within ±0.01 of the threshold, so ρ ≈ 800. Capping
the score change at 1e-3 predicts 0.8 flips per two million. That build measured zero.

## The general shape

Three things only showed up in the equations. The **permutation identity** proves why no decision
changes — it is an identity, not an approximation. The **mean/deviation split** told me where the
bound had to be measured; without splitting it I would still be overshooting by 4x. The **rank
deficiency** is a trap waiting for anyone who quotes a singular-value ratio.

Reading only the numbers misses all three. The second one especially: the code ran without error
and produced plausible values, so nothing signalled a problem until I rewrote the expression.

## Notes

- When you claim a transform preserves the function, verify it as an identity. Permutation is exact, not approximate.
- Check what your bound is measured against. Subtracting the mean removes a bias shift from the computation.
- The last singular value of a centered matrix is structurally zero. Check before quoting a condition number or a singular-value ratio.

### References

- Uchida, Y. et al. (2017). _Embedding Watermarks into Deep Neural Networks._ ICMR. (the original scheme encoding bits in the sign of a weight projection)
- Wang, S. et al. (2021). _Training Networks in Null Space of Feature Covariance for Continual Learning._ CVPR. (projects updates into the null space of the uncentered covariance — why the centering trap matters)
- Ainsworth, S. et al. (2023). _Git Re-Basin: Merging Models modulo Permutation Symmetries._ ICLR. (permutation symmetry of neural networks treated head-on)
