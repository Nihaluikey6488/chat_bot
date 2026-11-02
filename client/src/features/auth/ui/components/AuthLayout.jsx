import { Link } from 'react-router-dom'

export function AuthLayout({ title, subtitle, children, footerText, footerLink, footerLabel }) {
  return (
    <div className="min-h-screen bg-white px-4 py-6 text-[#0D0D0D] dark:bg-[#212121] dark:text-[#ECECEC] flex items-center content-center">
      <div className="mx-auto w-full max-w-[460px] rounded-2xl border border-[#E5E5E5] bg-[#F7F7F8] p-6 dark:border-[#3A3A3A] dark:bg-[#2F2F2F]">
        <h1 className="text-[30px] font-semibold tracking-tight">{title}</h1>
        <p className="mt-3 text-[15px] leading-relaxed text-[#6E6E80] dark:text-[#A9A9B3]">{subtitle}</p>
        {children}
        <div className="mt-3 flex items-center gap-2 text-sm text-[#6E6E80] dark:text-[#A9A9B3]">
          <span>{footerText}</span>
          <Link
            className="font-medium text-[#10A37F] transition-colors hover:text-[#1A7F64]"
            to={footerLink}
          >
            {footerLabel}
          </Link>
        </div>
      </div>
    </div>
  )
}
