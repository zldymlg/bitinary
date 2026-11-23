import { useNavigate } from 'react-router'
import { useAccount } from '@/app/account'
import { useT } from '@/app/i18n'
import { Jimbot } from '../mascot/Jimbot'
import { Button } from '../ui/Button'
import { Sheet } from '../ui/Sheet'

/** Shown when a guest tries to save something. */
export function AuthPrompt() {
  const { authPrompt, closeAuthPrompt } = useAccount()
  const t = useT()
  const navigate = useNavigate()
  return (
    <Sheet open={!!authPrompt} onClose={closeAuthPrompt}>
      <div className="flex flex-col items-center pb-2 text-center">
        <Jimbot expression="idea" variant="standalone" size={130} />
        <h2 className="mt-3 text-h2">{t('Gumawa ng libreng account', 'Create a free account')}</h2>
        <p className="mt-1 max-w-[320px] text-body text-fg-2">{authPrompt} {t('Mag-sign up para ma-save ito at makita sa lahat ng device mo.', 'Sign up to save it and see it on all your devices.')}</p>
        <Button
          block
          size="lg"
          className="mt-5"
          onClick={() => {
            closeAuthPrompt()
            navigate('/signup/role')
          }}
        >
          {t('Mag-sign up', 'Sign up')}
        </Button>
        <Button
          block
          variant="ghost"
          className="mt-1 !h-11"
          onClick={() => {
            closeAuthPrompt()
            navigate('/auth?mode=login')
          }}
        >
          {t('Mayroon na akong account', 'I already have an account')}
        </Button>
        <button onClick={closeAuthPrompt} className="mt-1 h-11 text-[15px] text-fg-2">
          {t('Mamaya na', 'Later')}
        </button>
      </div>
    </Sheet>
  )
}
