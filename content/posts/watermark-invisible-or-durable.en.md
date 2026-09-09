---
title: "No Watermark Is Both Invisible and Durable"
date: 2026-09-09
draft: false
tags: ["watermarking", "model protection", "permutation invariance", "quantization", "signal-to-noise"]
categories: ["ML"]
summary: "I built four ways to embed an ownership signature into model weights and measured each over two million sentences. The scheme that changes no decision is erased by a single canonicalization; the schemes that resist removal change decisions. The two turned out to sit on one knob."
---

## Where this came from

Shipping a model on-premises, we wanted a way to tell later which copy a leaked file came from. I built four schemes and measured them. The combination I actually wanted turned out to be structurally impossible.

## Order can carry a signature

A hidden layer is **invariant to unit order.** It is a sum over units, so permuting them is like changing who sits where at a table — the total is the same. Permute the rows of one layer and the matching columns of the next, and the function is mathematically identical.

That means **the seating arrangement itself can be the signature.** Pick disjoint unit pairs (a, b) as the key and read "a before b" as 1.

![Reordering hidden units leaves the output unchanged, so the order can carry a signature — but sorting erases it](/images/wm_permutation_en.svg)

Measured over two million sentences, **not a single decision changed.** The only output difference was 1e-06 from floating-point summation order. It holds 512 characters at no cost and embeds in three seconds.

## But sorting wipes it out

The weakness comes from the same property. An attacker who **sorts the units by any criterion** destroys the permutation. They do not need our key. With a tie-free criterion, two different customer copies hashed **identically**, and model accuracy stayed at 99.96% to the decimal.

Stated generally: **function-preserving weight transforms form a group, and groups have canonical forms.** Permutation and scaling are the obvious ones. The existence of a canonical form means anyone can map to it, and the moment they do, all position-within-the-group information is gone.

Sorting does leave a trace, though. In a normal model the correlation between unit index and weight magnitude is 0.01–0.02; in a sorted one it is exactly 1.0. You cannot tell whose copy it was, but you can prove it was deliberately laundered.

## Embedding in values inverts the problem

Schemes that nudge weight *values* survive sorting. In exchange, **they change decisions** — 30 to 39 flips per two million sentences. All of them sat near the decision threshold, on inputs the model was already unsure about, but the count is not zero.

So I tried a third thing: decompose the sentence representations into principal directions and find the ones **the data barely uses.** Push the weights only along those. Measured with the same push magnitude, the logit variation was 111x smaller.

## A quiet subspace is easy to erase from

It broke under ordinary optimization, and the reason is clean.

![Data energy falls off sharply across directions while quantization error stays flat](/images/wm_signal_noise_en.svg)

**Data energy concentrates in the leading directions, but quantization error does not care about direction.** In the bottom 120 directions the data holds 0.03% of its energy while 16.7% of the int4 error lands there — essentially the uniform share of 15.6%. The signal was 31x smaller than the noise, so a single quantization pass buried it.

Scaling the push up 100x made it survive quantization and pruning. Flips went from 0 to 7. Sweeping the scale from 1 to 5,000, **signal, removal resistance and flip count all moved together.** There was no region where resistance rose alone. **It is one knob.**

## The math

Notation. A sentence goes through the encoder to a hidden representation `h ∈ R^d` (d=768);
the classifier weight is `W ∈ R^(C×d)` with C classes, and the logits are `z = W h`.
Every decision comes out of that one vector.

**Why permutation preserves the function.** A permutation matrix `P` is orthogonal, so
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

**Low-energy directions come from an SVD.** Stack n representations into `H ∈ R^(n×d)`
with mean `μ`:

```
H − 1μᵀ = U Σ Vᵀ,     Σ = diag(s₁ ≥ … ≥ s_d)
energy share of direction i = s_i² / Σⱼ sⱼ²
```

Measured: the top 10 directions hold 77.62%, the bottom 120 hold 0.030%. One trap here —
`rank(H − 1μᵀ) ≤ min(n,d) − 1`, so **the last singular value is structurally zero.**
I measured `s₇₆₈ = 1.16e-05` against `s₇₆₇ = 0.146`, a factor of 12,562. Quoting
`s₁/s₇₆₈` gives an inflated ratio of 2.2×10⁷; the real spread is `s₁/s₇₆₇ = 1,814`.

**Confine the change to that subspace.** With `V_low ∈ R^(d×m)` holding the bottom m directions:

```
ΔW = A V_lowᵀ,        A ∈ R^(C×m)      degrees of freedom = C·m
Δz(h) = ΔW h = A (V_lowᵀ h)
```

The bracket is "how much this sentence loads on those directions" — near zero, so the logits
barely move.

**This is where the bug was.** Split the same expression into mean and deviation:

```
Δz(h) = A V_lowᵀ μ        ← common to every sentence (effectively a bias shift)
      + A V_lowᵀ (h − μ)  ← the part that varies per sentence
```

If you bound the change using **centered** H, the first term drops out of the computation.
A build I believed was within a 1e-4 bound was actually 4x over it. This is exactly why the
continual-learning literature uses the **uncentered** feature covariance. Measured, the
varying part shrinks 111x in the low-energy directions while the constant part shrinks only 6.6x.

**Magnitude cap.** Bound the sample max logit change by δ, then apply a scale s.

```
κ = min(1, δ / maxᵢ |Δz(hᵢ)|)
ΔW ← κ · s · ΔW
```

**Writing and reading bits.** With a secret matrix `X ∈ R^(B×Cm)`, target bits `bₖ`, and
signs `σₖ = 2bₖ − 1`:

```
embed: min_A  Σₖ softplus(1 − σₖ ⟨Xₖ, vec(A)⟩) + λ‖A‖²
read:  b̂ₖ = 1[ ⟨Xₖ, vec(A)⟩ > 0 ],   A = (W − W₀) V_low
```

The sign-based scheme reads `b̂ₖ = 1[⟨Xₖ, vec(W)⟩ > 0]` directly, so **it needs no reference
model.** The low-energy scheme needs `W₀`, and the permutation scheme needs the full original
to recover the ordering.

**Back to characters.** A 36-symbol alphabet gives 6 bits per character; majority vote over
r repetitions:

```
b̃ⱼ = 1[ Σ_{t<r} b̂_{j+tL} ≥ ⌊r/2⌋+1 ]
c   = ALPHA[ Σ_{i<6} b̃_{6j+i} · 2^(5−i) ]
```

**Signal to noise.** How much the read value moves under a quantizer `Q`:

```
signal = medianₖ |⟨Xₖ, vec(A)⟩|
noise  = meanₖ   |⟨Xₖ, vec(A_q − A)⟩|,   A_q = (Q(W) − W₀) V_low
```

At scale 1 this was `0.0015` against `0.0467` — the signal 31x below the noise. Scaling the
push by 100 moves S/N from 0.03 to 3.3, which is enough to survive int4.

**Expected flips.** Let ρ be the density of sentences near the threshold (sentences per unit
of score):

```
E[flips] ≈ maxᵢ |Δpᵢ| × ρ
```

Sixteen sentences out of two million sat within ±0.01 of the threshold, so ρ ≈ 800. Capping
the score change at 1e-3 predicts 0.8 flips per two million. That build measured zero.

## The general shape

**What makes a watermark hard to remove is that it is entangled with the part of the weights that affects the output.** Drive that influence to zero and the entanglement goes with it, leaving something easy to peel off. This is structural, not an implementation gap.

So the practical answer is to **layer schemes whose removal methods differ.** Order-based marks die to sorting; value-based marks die to spectral projection; the two attacks assume different things. An attacker who knows one cannot remove the other. Stacking three on one model worked without interference — they touch unit order, unused parameters, and weight values respectively, which do not overlap.

One more thing. **None of the four is evidence without prior commitment.** Given a clean model that was never watermarked, you can construct a key in seconds that reads out any string you want. Unless the key's hash was fixed with a timestamp at embedding time, "our key read out our signature" proves nothing.

## Notes

- Function-preserving transforms form a group. Where a canonical form exists, position inside the group is erasable in one step.
- Hiding in a quiet subspace exposes you to noise exactly as much as it hides you from the data. Noise is direction-agnostic.
- Watermarks need prior commitment. A key manufactured after the fact can be fitted to produce whatever you want.

### References

- Uchida, Y. et al. (2017). _Embedding Watermarks into Deep Neural Networks._ ICMR. (the origin of white-box watermarking via the sign of a weight projection)
- De Sousa Trias, C. et al. (2023). _Find the Lady: Permutation and Re-Synchronization of Deep Neural Networks._ arXiv:2312.14182. (treats neuron permutation as an attack and re-synchronizes against it)
- Pegoraro, A. et al. (2024). _DeepEclipse: How to Break White-Box DNN-Watermarking Schemes._ USENIX Security. (removes white-box watermarks without knowing the scheme)
- Wang, S. et al. (2021). _Training Networks in Null Space of Feature Covariance for Continual Learning._ CVPR. (projects updates into the null space of uncentered feature covariance to preserve prior outputs)
