import { describe } from 'vitest'
import { validateAgeGroup } from './validation.harness'

// Every survey combination for this age group, checked against the 17 validation rules.
describe('reglas de validación, edad 60-69', () => validateAgeGroup('60-69'))
