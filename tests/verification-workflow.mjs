import assert from 'node:assert/strict'
import {
  isAllowedVerificationFile,
  isVerificationObjectPath,
  MAX_DOC,
  verificationFileExtension,
} from '../src/lib/verify.ts'

const businessId = '123e4567-e89b-42d3-a456-426614174000'
const objectId = '987e6543-e21b-4d3c-b654-426614174000'

assert.equal(MAX_DOC, 10 * 1024 * 1024)
assert.equal(isAllowedVerificationFile({ size: MAX_DOC, type: 'application/pdf' }), true)
assert.equal(isAllowedVerificationFile({ size: MAX_DOC + 1, type: 'application/pdf' }), false)
assert.equal(isAllowedVerificationFile({ size: 1, type: 'image/svg+xml' }), false)
assert.equal(isAllowedVerificationFile({ size: 0, type: 'image/png' }), false)
assert.equal(verificationFileExtension('image/jpeg'), 'jpg')
assert.equal(isVerificationObjectPath(`${businessId}/${objectId}.pdf`, businessId), true)
assert.equal(isVerificationObjectPath(`${businessId}/permit.pdf`, businessId), false)
assert.equal(isVerificationObjectPath(`${businessId}/${objectId}.pdf`, 'another-business'), false)

console.log('verification-workflow: ok')
