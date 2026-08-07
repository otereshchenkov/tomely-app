import { afterEach, describe, expect, it } from 'vitest'

import { clearToken, getToken, setToken } from './token'

afterEach(() => {
  window.localStorage.clear()
  window.sessionStorage.clear()
})

describe('the token store', () => {
  it('has nothing to report before anyone signs in', () => {
    expect(getToken()).toBeNull()
  })

  it('keeps a remembered token in localStorage, where it survives a restart', () => {
    setToken('jwt-abc', true)

    expect(window.localStorage.getItem('tomely.token')).toBe('jwt-abc')
    expect(window.sessionStorage.getItem('tomely.token')).toBeNull()
    expect(getToken()).toBe('jwt-abc')
  })

  it('keeps an unremembered token in sessionStorage, where it does not', () => {
    setToken('jwt-abc', false)

    expect(window.sessionStorage.getItem('tomely.token')).toBe('jwt-abc')
    expect(window.localStorage.getItem('tomely.token')).toBeNull()
    expect(getToken()).toBe('jwt-abc')
  })

  it('does not leave the old token behind when the choice changes', () => {
    setToken('jwt-remembered', true)
    setToken('jwt-session', false)

    expect(window.localStorage.getItem('tomely.token')).toBeNull()
    expect(getToken()).toBe('jwt-session')
  })

  it('clears both storages, wherever the token happened to be', () => {
    setToken('jwt-abc', true)
    clearToken()
    expect(getToken()).toBeNull()

    setToken('jwt-abc', false)
    clearToken()
    expect(getToken()).toBeNull()
  })
})
