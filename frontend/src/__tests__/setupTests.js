// Setup pour React Testing Library
require('@testing-library/jest-dom')

const { TextDecoder, TextEncoder } = require('util')

global.TextEncoder = global.TextEncoder || TextEncoder
global.TextDecoder = global.TextDecoder || TextDecoder

global.ResizeObserver = global.ResizeObserver || class ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
}

global.AbortSignal.timeout = global.AbortSignal.timeout || (() => undefined)

Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: window.matchMedia || jest.fn().mockImplementation((query) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: jest.fn(),
    removeListener: jest.fn(),
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    dispatchEvent: jest.fn(),
  })),
})

jest.mock('react-router-dom', () => {
  const actual = jest.requireActual('react-router-dom')
  return {
    ...actual,
    useNavigate: () => jest.fn(),
    useLocation: () => ({ pathname: '/', search: '', hash: '', state: null, key: 'test' }),
  }
})
