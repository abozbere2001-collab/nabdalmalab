import * as React from "react"

const MOBILE_BREAKPOINT = 768

export function useIsMobile() {
  const [isMobile, setIsMobile] = React.useState<boolean | undefined>(true)

  React.useEffect(() => {
    // This logic is temporarily disabled to prevent a Workstation-specific error.
    // The hook will consistently report a mobile view.
    const mql = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`)
    const onChange = () => {
      setIsMobile(window.innerWidth < MOBILE_BREAKPOINT)
    }
    // Set initial value
    setIsMobile(window.innerWidth < MOBILE_BREAKPOINT)

    // We are commenting out the event listener to avoid the permission error on resize.
    // mql.addEventListener("change", onChange)
    // return () => mql.removeEventListener("change", onChange)
  }, [])

  return !!isMobile
}
