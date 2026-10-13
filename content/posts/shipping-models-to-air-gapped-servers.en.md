---
title: "How I Ship Models to Air-Gapped Servers — Split the Image from the Weights, Send the Mark and the Key by Different Routes"
date: 2026-10-06
draft: false
tags: ["MLOps", "Docker", "deployment", "air-gapped", "encryption", "watermark", "CI/CD"]
categories: ["MLOps"]
summary: "I had to install detection models on customer servers with no internet and update them periodically. I split the runtime into a Docker image and the weights into a separate bundle, and each bundle was embedded with a mark that differs per recipient and then encrypted. The key went by a different route. This post covers that structure and the problems I actually ran into while operating it."
---

## Constraints

I had to install a service that bundles several detection models on customer servers. Most customer servers have outside internet blocked. They cannot pull images from a registry or reach a model hub. The models are updated weekly, but the service code changes far less often. And if a model leaked out, I had to be able to tell which delivery it came from.

The structure I settled on under these constraints comes down to three principles. Split the runtime from the weights. Embed a different mark in the weights for each recipient and encrypt them. Send the key that unlocks the encryption by a different route from the bundle.

## Runtime as an image, weights separately

The service code and its dependencies are built into a Docker image, exported to a tar file with `docker save`, and delivered. The recipient loads it with `docker load` and brings it up with a compose file. Many servers have no GPU, so I built separate CPU and GPU images. The GPU image includes the CUDA runtime, which makes it three to four times the size of the CPU image, and it requires the NVIDIA driver and container toolkit on the server.

The weights did not go into the image. They are delivered separately as a model bundle, and the container reads them by mounting the host's model directory as a volume. The bundle contains a manifest listing where each model file is, so the service reads the manifest and does not hardcode the directory structure. With this split, a weekly model update does not require resending a multi-GB image, and an image hotfix does not touch the models.

## The delivery source stays immutable

The training repository and the working tree are changed all the time by many jobs. Packaging straight from there makes it impossible to reproduce what went out. So I kept only the models meant for delivery separately, in dated release folders on shared storage.

- A release folder is never overwritten. When a model changes, I create a new dated folder and change only the single line of the pointer file that points to the current baseline.
- The folder structure matches the container's model directory, so it can be mounted as is for testing.
- A SHA-256 list of every file is kept alongside, and I re-verify everything after each copy and each modification, because network storage leaves partial copies behind when a session drops.
- Each release gets a change record: which model was taken from which run, and which settings have to change together with it.

The packaging script reads only this release to build the delivery bundle.

## The mark goes in at packaging, different for each recipient

At packaging time, a mark unique to the recipient is embedded in the weights of each model. It is embedded in a way that does not affect performance, and applied only to a copy, leaving the source release untouched. The bundle name also carries the recipient's identifier.

The mark alone is not evidence, because if you make a key after the fact you can read any string you like out of any model. So at embedding time I recorded, per model, the hash of the delivered copy, the sealed value of the mark, the sealing time, and the ledger sequence number. This record is not used for installation. When a leaked copy is verified later, it is the grounds for saying "this value was fixed at that time". The key that reads the mark never goes into the deliverable.

## Encrypt, and send the key by a different route

The marked weights are encrypted with a data key newly generated for each delivery. This key is sent by a different route from the bundle. The lock and the key do not go in the same envelope. The recipient registers the key once, interactively, at first installation, and the container decrypts the weights with that key as it starts. Without the key the service does not start.

The key changes with every delivery. So updating the models means registering the key again, and rolling back to the previous models means rolling back to the previous key as well. I wrote the procedures and the troubleshooting table in the installation guide around this order too.

## What tripped me up in operation

These are problems I actually ran into.

- The integrity check comes first. If weights corrupted in transit are loaded, the service starts but the detection results are silently wrong. The first step of both the install and the update procedure is checksum verification.
- Sometimes only some of the models are updated. Replacing the whole model directory makes the models that did not come this time disappear. I wrote a separate procedure for restoring the rest from the backup.
- If you only `load` the new image and bring the service up again, the old image comes up, because the tag compose refers to is pinned in the config file. A hotfix is brought up with the new bundle's config, while the state directory holding the key and settings is carried over from the previous install.
- If the old key is still there, registering the new key is skipped as "already registered". I added removal of the old key to the update procedure. The key file is read only at startup, so a restart is needed after registration for it to take effect.
- One small config file went missing once. When the embedding model's pooling config file was left out of a release, the second-stage verifier that uses that embedding failed to load and silently turned off. The startup log still printed the configuration as "verifier included". I filled in the missing file, rebuilt the checksum list, and re-verified every file. I decided to fix the serving side so that the startup log reflects the actual load result, and the bundles already built from that release had to be rebuilt before going to any site that uses the verifier.
- The first-stage model and the combiner that takes its scores as input are replaced only as a pair. Replacing only the first stage changes the score distribution the combiner receives, and the decisions break down. The release record lists the "settings that must change together" separately, and the previous model folder is kept for rollback.

## Takeaways

In air-gapped delivery, splitting the runtime from the weights lets you handle two things with different update cycles separately. The delivery source is fixed with immutable releases and checksums, and at packaging a mark is embedded per recipient and the values at that moment are sealed in a record. The weights are encrypted and the key goes by a different route. Most of the problems I actually hit in operation were "silent failures". The response was to put checksum verification, per-component load checks, and the pair-replacement rule into the procedures.
