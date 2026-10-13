---
title: "When a Valid Signature Still Has to Be Rejected — The Nonce"
date: 2026-09-09
draft: false
tags: ["API security", "authentication", "HMAC", "replay attack", "gateway"]
categories: ["ML"]
summary: "Attaching an HMAC signature to an API request stops tampering with the content. But copy a validly signed request whole and send it again, and it passes as is. This post separates what the signature blocks from what the nonce blocks."
---

## Continuing

While reading authentication specs for opening an API to the outside, I did not get right away why a signature and a nonce are **both** needed. I thought having a signature already prevents forgery, but the two block different things.

## A signature checks 'has the content changed'

The sender and the receiver share **the same secret key**. The sender mixes that key into the request content, derives a short value, and sends it along (HMAC). The receiver runs the same computation on the content that arrived and compares the two values.

![If the request content is changed, it no longer matches the signature the server recomputes and is rejected](/images/hmac_signature.svg)

Even if someone in the middle changes the amount, **they cannot produce a signature that matches the changed content.** They do not have the secret key. So when the server recomputes, the values disagree and the request is rejected.

Here, **what goes into the signed material** matters. If you sign only the body and leave out the path or the method, redirecting the same body to a different endpoint passes. That is why real-world specs sign `method + path + timestamp + body hash` together.

## A nonce checks 'have I seen this request before'

The problem is that the signature covers **only the content**. If an attacker copies a legitimate request whole and sends it again unchanged, the content has not changed, so **the signature is still valid too.** The transfer request gets processed twice.

![Even with a valid signature, the same nonce arriving twice is treated as a replay and rejected](/images/hmac_nonce.svg)

So each request carries **a random value used only once** (a nonce), and that value is included in the signature as well. The receiver records the nonces it has seen, and if the same value arrives again it rejects the request even if the signature is correct.

Nonces cannot be remembered forever, so they are usually used **together with a timestamp**. "Accept only requests from the last 5 minutes" narrows the window, and only the nonces inside that window are stored. That makes the store finite. In return, if clocks drift between servers, legitimate requests get rejected, so clock synchronization comes along as a prerequisite.

## Put it in a gateway, or attach it alongside

Where to do authentication is a placement question. Two options are common.

**With a gateway**, all traffic passes through the front. Authentication, inspection, and logging happen in one place, so policy does not leak, and the services behind it do not need to know about authentication. In return, if the front goes down everything stops, and latency is added one more time.

**With a proxy/sidecar**, the checker sits next to the call site. There is no single point of failure at the front and latency is short, but **it has to be attached at every call site**, so if you miss one, that path is unprotected. As I wrote in another post, "the feature exists" and "that path actually calls it" are separate things.

Both give the same strength of authentication itself. Where they differ is **whether something can be left out**.

## Zooming out

A signature and a nonce block **forgery** and **reuse** respectively. Their names are similar, so they are easy to lump into one, but with only one the other side is left open. Pairs like this come up often in security design: integrity and freshness, authentication and authorization, encryption and signing. Writing down in one line what each one blocks shows which side is empty.

ML services need the same distinction. Even if a model filters harmful input, that is **content inspection**, not **caller verification**. Conversely, strong authentication does not stop an attack sent by an authenticated user. Unless you write down what each layer is responsible for, a hole that no layer watches quietly remains.

## Notes

- A signature blocks content tampering, and a nonce blocks replay. With only one, the other side is open.
- Include the method, path, and timestamp in what is signed. If only the body is signed, sending the same body somewhere else passes.
- Keep the nonce store finite with a timestamp window. In return, clock synchronization becomes a prerequisite.

### References

- Krawczyk, H., Bellare, M., Canetti, R. (1997). _HMAC: Keyed-Hashing for Message Authentication._ RFC 2104. (The standard definition of message authentication based on a shared secret key)
- Needham, R., Schroeder, M. (1978). _Using Encryption for Authentication in Large Networks of Computers._ CACM. (The classic that first laid out replay attacks and the need for nonces)
- Neuman, B. C., Ts'o, T. (1994). _Kerberos: An Authentication Service for Computer Networks._ IEEE Communications. (A real design that uses a timestamp window together with a replay cache)
