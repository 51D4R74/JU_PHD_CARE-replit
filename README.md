# JUPHDCARE

Plataforma corporativa de gestão de riscos psicossociais e saúde mental.

Referências metodológicas e limites de uso estão documentados em [DOCS/methodology-sources.md](DOCS/methodology-sources.md).

Matriz de rastreabilidade das perguntas atualmente implementadas em [DOCS/checkin-traceability-matrix.md](DOCS/checkin-traceability-matrix.md).

Protocolo mínimo de agregação e anonimato do painel RH em [DOCS/rh-aggregation-protocol.md](DOCS/rh-aggregation-protocol.md).

Roteiro para produzir evidência com o próprio aplicativo em [DOCS/app-evidence-acquisition-roadmap.md](DOCS/app-evidence-acquisition-roadmap.md).

Matriz operacional de coleta e promoção de evidência em [DOCS/evidence-collection-matrix.md](DOCS/evidence-collection-matrix.md).

Especificação do primeiro pulse formal em [DOCS/first-formal-pulse-spec.md](DOCS/first-formal-pulse-spec.md).

Backlog técnico da trilha de evidência em [DOCS/evidence-implementation-backlog.md](DOCS/evidence-implementation-backlog.md).

Auditoria da modelagem atual para pulses em [DOCS/pulse-model-gap-analysis.md](DOCS/pulse-model-gap-analysis.md).

Auditoria do acervo científico local em [DOCS/inicio-scientific-audit.md](DOCS/inicio-scientific-audit.md).

Base consolidada de NR-1, orientação oficial e referências científicas em [DOCS/nr1-methodological-base.md](DOCS/nr1-methodological-base.md).

## Arquitetura de autenticação

- A plataforma usa autenticação própria com JWT HS256 em cookie `httpOnly` (`lumina.token`).
- O cliente mantém apenas o espelho seguro do usuário autenticado para UX e roteamento; a autorização canônica permanece no servidor.
- Não usamos Cognito neste produto atual. A escolha é deliberada para evitar acoplamento prematuro a IAM externo antes de fechar billing, memberships e isolamento multi-tenant.
- A autorização administrativa agora combina `role` global e capabilities explícitas por membership de tenant no control plane.

## Governança do catálogo

- Planos de tenant são entidades governadas no control plane, não seed técnica opaca.
- O código do plano é imutável após criação para preservar rastreabilidade contratual, integrações e histórico operacional.
- A despublicação do plano é bloqueada quando existe tenant ativo usando esse código, evitando drift de catálogo e quebra de provisionamento.

## Billing e metering de uso

- Períodos de cobrança por tenant registram o MAU contratado vs. consumido com rastreabilidade histórica completa.
- Invariante mantida a nível de rota: ao criar um novo período de cobrança, o período anterior é encerrado automaticamente — nunca há dois períodos ativos para o mesmo tenant.
- O controle de acesso ao catálogo de billing e aos endpoints de metering segue a mesma capability `control_plane:write` usada no catálogo de planos.

## Pulse formal — agregado psicossocial

- O `GET /api/rh/pulses/aggregate` implementa k-anonimato com `ANONYMITY_THRESHOLD = 5`: escores só são retornados quando há 5+ respondentes únicos no ciclo de 45 dias.
- O painel RH exibe o k-anonimato de forma explícita (flag `eligible`) sem vazar dados individuais.
- A janela de coleta e o delta de tendência entre ciclos são computados inteiramente no servidor — o cliente é puramente declarativo.
