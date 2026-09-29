# Custom domain activation

Checked on September 29, 2026. The existing public application remains available at:

https://git-architecture-diagram.pro-amine.chatgpt.site

`gitarchitecturediagram.com` is attached to that same Site. Its current provider status is **pending**, and HTTPS is **pending validation**. Attaching a hostname is not the same as a working DNS connection. The Hostinger DNS zone has not been modified in this implementation session: no usable authorized DNS connector is available, and the previous browser access restriction was not bypassed.

## Records returned by the hosting provider

In the DNS zone for **gitarchitecturediagram.com**, configure these records. Hostinger's Name field normally uses the short name shown here; the full-name column identifies the exact DNS owner.

| Type | Name | Full name | Value |
| --- | --- | --- | --- |
| A | `@` | `gitarchitecturediagram.com` | `162.159.143.30` |
| A | `@` | `gitarchitecturediagram.com` | `172.66.3.26` |
| TXT | `_openai-site-verification` | `_openai-site-verification.gitarchitecturediagram.com` | `openai-site-verification=6b3vidJuQZJHCxWx9JYhXTFlAypURmu172IIgELMV1Q` |
| TXT | `_cf-custom-hostname` | `_cf-custom-hostname.gitarchitecturediagram.com` | `ae0a040a-3e41-499d-bd7b-995b0dfc987c` |

Replace conflicting web-hosting records only for this domain's apex as necessary. Preserve unrelated email and verification records. Use the DNS provider's default TTL. After records propagate, refresh the custom-domain validation until the hostname and SSL are active. No exact propagation time is guaranteed.

The application already includes `https://gitarchitecturediagram.com` in its allowed production origins. Once DNS and HTTPS validation succeed, this address should route to the same deployed application without another source change:

https://gitarchitecturediagram.com/ProAmineOfficial/NanoKit-ESP32/tree/main/examples_on_platformio/ultrasonic_distance

The generated-domain equivalent can be used now. Verify the custom-domain deep link after activation; this document does not claim it has already passed.

`diagram.proamine.tech` and `gitarchitecturediagram.proamine.tech` remain attached as separate pending alternatives. They use hostname-specific verification records; do not reuse the apex domain's TXT values for them. The existing proamine.tech website is unchanged. No new domain was bought, renewed, or charged during this implementation.
