export default function SafeArea({ className='', children }){
  return <div className={`tv-safe ${className}`}>{children}</div>;
}
