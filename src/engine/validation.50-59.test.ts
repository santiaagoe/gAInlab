import { describe } from 'vitest'
import { validateAgeGroup } from './validation.harness'

// Every survey combination for this age group, checked against the 17 validation rules.
describe('reglas de validación, edad 50-59', () => validateAgeGroup('50-59'))
