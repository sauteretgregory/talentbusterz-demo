export const EDUCATION_LEVELS = Object.freeze([
  'below_bac',
  'bac',
  'bac_plus_1',
  'bac_plus_2',
  'bac_plus_3',
  'bac_plus_4',
  'bac_plus_5',
  'bac_plus_8'
])

export const EDUCATION_LEVEL_ORDER = Object.freeze(
  Object.fromEntries(
    EDUCATION_LEVELS.map((level, index) => [
      level,
      index
    ])
  )
)

export function isCanonicalEducationLevel(value) {
  return (
    typeof value === 'string' &&
    EDUCATION_LEVEL_ORDER[value] !== undefined
  )
}

export function compareEducationLevels(left, right) {
  if (
    !isCanonicalEducationLevel(left) ||
    !isCanonicalEducationLevel(right)
  ) {
    throw new Error(
      'TBZ: education levels must use the canonical vocabulary.'
    )
  }

  return (
    EDUCATION_LEVEL_ORDER[left] -
    EDUCATION_LEVEL_ORDER[right]
  )
}
