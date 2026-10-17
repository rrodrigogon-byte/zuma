import { useCallback, useEffect, useRef, useState } from 'react'
import { cepDigits, cepStatusMessage, fetchCepAddress, isCityWideCep } from './cep.js'

/**
 * Preenche o endereço quando a pessoa termina de digitar o CEP.
 * Só consulta quando o CEP é digitado (chamando onCepInput no onChange do campo):
 * abrir um cadastro já salvo não troca o endereço que está gravado.
 *
 * const cepInfo = useCepAutofill(found => setForm(current => mergeCepAddress(current, found)))
 * <input value={form.cep} onChange={e => { change('cep', e.target.value); cepInfo.onCepInput(e.target.value) }} />
 * {cepInfo.message && <small className={`cep-hint is-${cepInfo.tone}`}>{cepInfo.message}</small>}
 */
export function useCepAutofill(onFound) {
  const [state, setState] = useState({ loading: false, message: '', tone: '' })
  const onFoundRef = useRef(onFound)
  const controllerRef = useRef(null)
  const lastRef = useRef('')
  onFoundRef.current = onFound

  useEffect(() => () => controllerRef.current?.abort(), [])

  const lookup = useCallback(async (value, { force = false } = {}) => {
    const cep = cepDigits(value)
    if (cep.length !== 8) {
      lastRef.current = ''
      controllerRef.current?.abort()
      setState({ loading: false, message: '', tone: '' })
      return null
    }
    if (!force && lastRef.current === cep) return null
    lastRef.current = cep
    controllerRef.current?.abort()
    const controller = new AbortController()
    controllerRef.current = controller
    setState({ loading: true, message: 'Buscando endereço pelo CEP…', tone: 'muted' })
    try {
      const found = await fetchCepAddress(cep, { signal: controller.signal })
      if (controller.signal.aborted) return null
      onFoundRef.current?.(found)
      setState({ loading: false, message: cepStatusMessage({ found }), tone: isCityWideCep(found) ? 'warn' : 'ok' })
      return found
    } catch (error) {
      if (error?.name === 'AbortError' || controller.signal.aborted) return null
      lastRef.current = ''
      setState({ loading: false, message: cepStatusMessage({ error }), tone: 'error' })
      return null
    } finally {
      if (controllerRef.current === controller) controllerRef.current = null
    }
  }, [])

  return { ...state, lookup, onCepInput: lookup }
}
