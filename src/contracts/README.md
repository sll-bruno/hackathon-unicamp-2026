# Contratos compartilhados

`contracts.pipeline` define somente o envelope mínimo compartilhado entre engine
e API. Campos extras da engine são aceitos e persistidos; mudanças nos campos
mínimos devem ser alinhadas pelas três frentes antes da integração.

A API persiste também os campos extras e os projeta no contrato HTTP do
workspace. O frontend consome a API real por padrão; fixtures só são ativadas
explicitamente com `VITE_USE_MOCKS=true`.
