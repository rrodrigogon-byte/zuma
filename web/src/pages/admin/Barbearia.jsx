/**
 * Compatibilidade para links legados da Barbearia.
 *
 * A implementação operacional e persistida vive em BarbeariaERP. Reexportá-la
 * aqui elimina a duplicação que ainda exibia dados simulados e endpoints antigos,
 * sem quebrar favoritos ou integrações que apontam para /admin/barbearia.
 */
export { default } from './BarbeariaERP'
