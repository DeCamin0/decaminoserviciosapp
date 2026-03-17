import { useState, useMemo } from 'react';
import { useAuth } from '../contexts/AuthContextBase';
import { useNavigate } from 'react-router-dom';
import Footer from '../components/Footer';
import { isDemoMode } from '../utils/demo';
import DemoModal from '../components/DemoModal';
import { config } from '../config/env.js';

export default function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const now = useMemo(() => new Date(), []);
  // Sezon de sărbători: decembrie (luna 11) sau ianuarie până pe 6 ianuarie (luna 0, zilele <= 6)
  const isHolidaySeason = now.getMonth() === 11 || (now.getMonth() === 0 && now.getDate() <= 6);
  const [formData, setFormData] = useState({
    email: '',
    password: ''
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showDemoModal, setShowDemoModal] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    const result = await login(formData.email, formData.password);

    if (result.success) {
      // Verifică dacă există o rută de redirect salvată
      const redirectPath = sessionStorage.getItem('redirectAfterLogin');
      if (redirectPath && redirectPath !== '/login') {
        sessionStorage.removeItem('redirectAfterLogin');
        navigate(redirectPath, { replace: true });
      } else {
        navigate('/inicio', { replace: true });
      }
    } else {
      setError(result.error);
    }
    
    setLoading(false);
  };

  const handleInputChange = (field, value) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const togglePasswordVisibility = () => {
    setShowPassword(!showPassword);
  };

  const handleDemoMode = () => {
    console.log('🎭 handleDemoMode called');
    setShowDemoModal(true);
  };

  // Fundal: folosește DOAR variabila CSS (setată de script în index.html la load) – fallback teal pentru Client 2
  const primaryFallback = config.PRIMARY_COLOR && config.PRIMARY_COLOR.trim() ? (config.PRIMARY_COLOR.startsWith('#') ? config.PRIMARY_COLOR : '#' + config.PRIMARY_COLOR) : '#2563A8';
  const isClient2 = (config.LOGO_PATH || '').toLowerCase().includes('hera');
  const logoContainerClass = isClient2
    ? 'w-40 h-28 bg-white/30 backdrop-blur-md rounded-xl flex items-center justify-center shadow-2xl border border-white/40 group-hover:border-[var(--primary-color)]/70 transition-all duration-500'
    : 'w-28 h-28 bg-white/30 backdrop-blur-md rounded-full flex items-center justify-center shadow-2xl border border-white/40 group-hover:border-[var(--primary-color)]/70 transition-all duration-500';
  const logoGlowClass = isClient2
    ? 'absolute inset-0 w-40 h-28 bg-gradient-to-r from-[var(--primary-color)]/40 to-[var(--primary-color-darkest)]/40 rounded-xl blur-xl animate-glow group-hover:from-[var(--primary-color)]/60 group-hover:to-[var(--primary-color)]/60 transition-all duration-500'
    : 'absolute inset-0 w-28 h-28 bg-gradient-to-r from-[var(--primary-color)]/40 to-[var(--primary-color-darkest)]/40 rounded-full blur-xl animate-glow group-hover:from-[var(--primary-color)]/60 group-hover:to-[var(--primary-color)]/60 transition-all duration-500';
  // La HERA: fundal login mai deschis decât logo-ul (albastru proaspăt) ca logo-ul să se vadă bine
  const loginBgStyle = isClient2
    ? { background: 'linear-gradient(160deg, #C5DCF0 0%, #A8CDE8 50%, #7EB8DD 100%)' }
    : { backgroundColor: 'var(--primary-color, ' + primaryFallback + ')' };
  return (
    <div className="min-h-screen relative overflow-hidden" style={loginBgStyle}>
      {/* Custom CSS pentru animații avansate */}
      <style>{`
        @keyframes float {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(-20px); }
        }
        
        @keyframes glow {
          0%, 100% { box-shadow: 0 0 20px var(--primary-color-rgba-04, rgba(239, 68, 68, 0.4)); }
          50% { box-shadow: 0 0 40px var(--primary-color-rgba-06, rgba(239, 68, 68, 0.8)); }
        }
        
        @keyframes shimmer {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(100%); }
        }
        
        @keyframes gradientShift {
          0% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
          100% { background-position: 0% 50%; }
        }
        
        @keyframes textFloat {
          0%, 100% { transform: perspective(1000px) rotateX(15deg) translateY(0px) rotateZ(0deg); }
          25% { transform: perspective(1000px) rotateX(20deg) translateY(-5px) rotateZ(1deg); }
          50% { transform: perspective(1000px) rotateX(10deg) translateY(-10px) rotateZ(-1deg); }
          75% { transform: perspective(1000px) rotateX(18deg) translateY(-5px) rotateZ(0.5deg); }
        }
        
        @keyframes textGlow {
          0%, 100% { 
            text-shadow: 0 0 20px rgba(255, 255, 255, 0.8), 0 0 40px var(--primary-color-rgba-06), 0 0 60px var(--primary-color-rgba-04), 0 0 80px var(--primary-color-rgba-02);
            filter: drop-shadow(0 0 10px rgba(255, 255, 255, 0.5)) drop-shadow(0 0 20px var(--primary-color-rgba-04));
          }
          50% { 
            text-shadow: 0 0 30px rgba(255, 255, 255, 1), 0 0 60px var(--primary-color-rgba-06), 0 0 90px var(--primary-color-rgba-04), 0 0 120px var(--primary-color-rgba-02);
            filter: drop-shadow(0 0 15px rgba(255, 255, 255, 0.8)) drop-shadow(0 0 30px var(--primary-color-rgba-05));
          }
        }
        
        @keyframes shadowFloat {
          0%, 100% { transform: translate(4px, 4px) perspective(1000px) rotateX(15deg) scale(1); }
          50% { transform: translate(6px, 6px) perspective(1000px) rotateX(20deg) scale(1.02); }
        }
        
        @keyframes particleMove {
          0% { transform: translateX(-100%) translateY(-100%) rotate(0deg); opacity: 0; }
          25% { opacity: 1; }
          50% { transform: translateX(100%) translateY(-50%) rotate(180deg); opacity: 0.8; }
          75% { opacity: 1; }
          100% { transform: translateX(200%) translateY(100%) rotate(360deg); opacity: 0; }
        }
        
        @keyframes ripple {
          0% { width: 0; height: 0; opacity: 1; }
          100% { width: 200px; height: 200px; opacity: 0; }
        }
        
        .animate-float {
          animation: float 6s ease-in-out infinite;
        }
        
        .animate-glow {
          animation: glow 2s ease-in-out infinite;
        }
        
        .animate-shimmer {
          animation: shimmer 2s infinite;
        }
        
        .glassmorphism {
          background: rgba(255, 255, 255, 0.1);
          backdrop-filter: blur(20px);
          border: 1px solid rgba(255, 255, 255, 0.2);
        }
        
        .gradient-text {
          background: linear-gradient(45deg, var(--primary-color-rgba-01, rgba(0,0,0,0.1)), var(--primary-color-rgba-02, rgba(0,0,0,0.2)), var(--primary-color), var(--primary-color-darker, #b91c1c), var(--primary-color-darkest, #7f1d1d));
          background-size: 300% 300%;
          animation: gradient 4s ease infinite;
          -webkit-background-clip: text;
          background-clip: text;
          -webkit-text-fill-color: transparent;
        }
        
        @keyframes gradient {
          0% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
          100% { background-position: 0% 50%; }
        }
        
        /* Decor sezonier - activ doar când isHolidaySeason este true */
        .snowflake {
          position: absolute;
          top: -10%;
          color: rgba(170, 205, 255, 0.9);
          font-size: 13px;
          animation-name: snowfall;
          animation-timing-function: linear;
          animation-iteration-count: infinite;
          pointer-events: none;
        }
        .dark .snowflake {
          color: rgba(255,255,255,0.9);
        }
        @keyframes snowfall {
          0% { transform: translateY(0) translateX(0) rotate(0deg); opacity: 0; }
          10% { opacity: 1; }
          100% { transform: translateY(110vh) translateX(26px) rotate(360deg); opacity: 0; }
        }
      `}</style>
      {/* Fundal animat cu particule și gradient - culori din --primary-color (config per client) */}
      <div className="absolute inset-0">
        <div className="absolute inset-0 bg-gradient-to-br from-[var(--primary-color)]/30 via-[var(--primary-color)]/20 to-[var(--primary-color-darkest)]/30"></div>
        
        <div className="absolute inset-0 opacity-20">
          <div className="absolute top-0 left-0 w-full h-full">
            <svg className="w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="xMidYMid slice">
              <defs>
                <radialGradient id="gradient" cx="50%" cy="50%" r="50%">
                  <stop offset="0%" stopColor="var(--primary-color-rgba-02, rgba(0,0,0,0.2))" />
                  <stop offset="50%" stopColor="var(--primary-color-rgba-02, rgba(0,0,0,0.15))" />
                  <stop offset="100%" stopColor="var(--primary-color-rgba-02, rgba(0,0,0,0.2))" />
                </radialGradient>
              </defs>
              <rect width="100%" height="100%" fill="url(#gradient)" />
            </svg>
          </div>
        </div>
        
        <div className="absolute top-1/4 left-1/4 w-64 h-64 bg-gradient-to-r from-[var(--primary-color)]/25 to-[var(--primary-color-darkest)]/25 rounded-full blur-3xl animate-float"></div>
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-gradient-to-r from-[var(--primary-color)]/20 to-[var(--primary-color-darkest)]/20 rounded-full blur-3xl animate-float" style={{animationDelay: '2s'}}></div>
        <div className="absolute top-3/4 left-1/2 w-48 h-48 bg-gradient-to-r from-[var(--primary-color)]/30 to-[var(--primary-color)]/25 rounded-full blur-3xl animate-float" style={{animationDelay: '4s'}}></div>
      </div>

      {/* Decor sezonier de Crăciun/Reyes (activ până pe 6 ianuarie) */}
      {isHolidaySeason && (
        <>
          {/* Ninsoare animată */}
          <div className="pointer-events-none absolute inset-0 overflow-hidden z-5">
            {Array.from({ length: 50 }).map((_, idx) => (
              <span
                key={idx}
                className="snowflake"
                style={{
                  left: `${(idx * 100) / 50}%`,
                  animationDuration: `${6 + (idx % 5)}s`,
                  animationDelay: `${idx * 0.2}s`,
                  fontSize: `${10 + (idx % 5) * 2}px`
                }}
              >
                ❄
              </span>
            ))}
          </div>

          {/* Halo de fundal pentru sezon */}
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center z-0">
            <div className="w-[600px] h-[600px] rounded-full bg-gradient-to-br from-amber-200/8 via-red-200/10 to-orange-100/8 blur-3xl animate-pulse" />
          </div>
        </>
      )}

      {/* Conținut principal */}
      <div className="relative z-10 min-h-screen flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
        <div className="w-full max-w-md">
          {/* Header: Client 2 = elegant minimal; Client 1 = cu efecte */}
          <div className="text-center mb-8">
            {isClient2 ? (
              /* HERA – fundal deschis, text închis ca să se vadă */
              <>
                <div className="flex justify-center mb-8">
                  <a href={config.EXTERNAL_SITE_URL} target="_blank" rel="noopener noreferrer" className="inline-block focus:outline-none transition transform hover:scale-[1.02]" title={`Visita ${config.COMPANY_NAME}`}>
                    <img
                      src={`${(config.BASE_PATH || '/')}${config.LOGO_PATH || 'logo.svg'}`.replace(/\/+/g, '/')}
                      alt={`${config.COMPANY_NAME} Logo`}
                      className="h-24 w-auto max-w-[340px] object-contain drop-shadow-[0_2px_12px_rgba(0,0,0,0.15)]"
                      onError={(e) => { e.target.style.display = 'none'; }}
                    />
                  </a>
                </div>
                <div className="space-y-4">
                  <h1 className="text-6xl font-black mb-2 relative group">
                    <span className="inline-block transform group-hover:scale-110 transition-all duration-700" style={{
                      background: 'linear-gradient(45deg, var(--primary-color-darkest), var(--primary-color), var(--primary-color-darker), #1e3a5f, var(--primary-color), var(--primary-color-darkest))',
                      backgroundSize: '400% 400%',
                      WebkitBackgroundClip: 'text',
                      WebkitTextFillColor: 'transparent',
                      backgroundClip: 'text',
                      filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.08))',
                      animation: 'gradientShift 2s ease-in-out infinite, textFloat 4s ease-in-out infinite',
                      transform: 'perspective(1000px) rotateX(15deg)',
                      transformStyle: 'preserve-3d'
                    }}>
                      {config.COMPANY_NAME.split(' ').slice(0, 2).join(' ')}
                    </span>
                    <span className="absolute inset-0 text-6xl font-black opacity-30 blur-md" style={{
                      background: 'linear-gradient(45deg, var(--primary-color), var(--primary-color-darker), var(--primary-color-darkest))',
                      WebkitBackgroundClip: 'text',
                      WebkitTextFillColor: 'transparent',
                      backgroundClip: 'text',
                      transform: 'translate(4px, 4px) perspective(1000px) rotateX(15deg)',
                      zIndex: -1,
                      animation: 'shadowFloat 4s ease-in-out infinite'
                    }}>
                      {config.COMPANY_NAME.split(' ').slice(0, 2).join(' ')}
                    </span>
                    <div className="absolute inset-0 overflow-hidden pointer-events-none">
                      <div className="absolute top-0 left-0 w-full h-full" style={{
                        background: 'radial-gradient(circle at 20% 20%, rgba(255, 255, 255, 0.3) 0%, transparent 50%), radial-gradient(circle at 80% 80%, var(--primary-color-rgba-04) 0%, transparent 50%)',
                        animation: 'particleMove 6s ease-in-out infinite'
                      }}></div>
                    </div>
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                      <div className="w-0 h-0 border-4 border-white/20 rounded-full animate-ping" style={{ animation: 'ripple 2s ease-out infinite' }}></div>
                    </div>
                  </h1>
                  <div className="w-24 h-1 bg-gradient-to-r from-[var(--primary-color)]/60 via-[var(--primary-color)] to-[var(--primary-color)]/60 mx-auto rounded-full"></div>
                  <h2 className="text-xl font-semibold text-gray-700 mb-2">Portal Empresarial</h2>
                  <p className="text-sm text-gray-600 font-medium">{config.COMPANY_NAME || config.COMPANY_NAME_LEGAL || ''}</p>
                </div>
              </>
            ) : (
              /* DeCamino – logo rotund + titlu cu efecte */
              <>
                <div className="flex justify-center mb-8">
                  <a href={config.EXTERNAL_SITE_URL} target="_blank" rel="noopener noreferrer" className="relative group transition-all duration-500 transform hover:scale-110 hover:rotate-3" title={`Visita el sitio web de ${config.COMPANY_NAME}`}>
                    <div className="relative">
                      <div className={logoContainerClass}>
                        <img
                          src={window.location.hostname.includes('ngrok') ? 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iODAiIGhlaWdodD0iODAiIHZpZXdCb3g9IjAgMCA4MCA4MCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPGNpcmNsZSBjeD0iNDAiIGN5PSI0MCIgcj0iNDAiIGZpbGw9IiNFRTM5MzUiLz4KPHRleHQgeD0iNTAlIiB5PSI1MCUiIGZvbnQtZmFtaWx5PSJBcmlhbCwgc2Fucy1zZXJpZiIgZm9udC1zaXplPSIyOCIgZm9udC13ZWlnaHQ9ImJvbGQiIGZpbGw9IndoaXRlIiB0ZXh0LWFuY2hvcj0ibWlkZGxlIiBkeT0iLjNlbSI+REM8L3RleHQ+Cjwvc3ZnPgo=' : `${(config.BASE_PATH || '/')}${config.LOGO_PATH || 'logo.svg'}`.replace(/\/+/g, '/')}
                          alt={`${config.COMPANY_NAME || 'App'} Logo`}
                          className="h-20 w-20 object-contain group-hover:scale-110 transition-transform duration-500"
                          onError={(e) => { e.target.style.display = 'none'; e.target.nextSibling.style.display = 'block'; }}
                        />
                        <div className="hidden text-white font-bold text-2xl group-hover:text-[var(--primary-color)] transition-colors duration-500">DC</div>
                      </div>
                      {isHolidaySeason && (
                        <div className="absolute -top-2 -right-4 w-12 h-8 transform rotate-12">
                          <div className="absolute inset-0 bg-[var(--primary-color)] rounded-tl-2xl rounded-tr-2xl rounded-bl-sm rounded-br-md shadow-lg border border-[var(--primary-color-darkest)]"></div>
                          <div className="absolute -bottom-1 left-0 right-0 h-2 bg-white rounded-full shadow-md"></div>
                          <div className="absolute -bottom-3 -right-1 w-4 h-4 bg-white rounded-full shadow-sm"></div>
                        </div>
                      )}
                      <div className={logoGlowClass}></div>
                    </div>
                  </a>
                </div>
                <div className="space-y-4">
                  <h1 className="text-6xl font-black mb-2 relative group">
                    <span className="inline-block transform group-hover:scale-110 transition-all duration-700" style={{
                      background: 'linear-gradient(45deg, #ffffff, var(--primary-color), var(--primary-color-darker), var(--primary-color-darkest), var(--primary-color), #ffffff)',
                      backgroundSize: '400% 400%',
                      WebkitBackgroundClip: 'text',
                      WebkitTextFillColor: 'transparent',
                      backgroundClip: 'text',
                      textShadow: '0 0 20px rgba(255, 255, 255, 0.8), 0 0 40px var(--primary-color-rgba-06), 0 0 60px var(--primary-color-rgba-04), 0 0 80px var(--primary-color-rgba-02)',
                      filter: 'drop-shadow(0 0 10px rgba(255, 255, 255, 0.5)) drop-shadow(0 0 20px var(--primary-color-rgba-04))',
                      animation: 'gradientShift 2s ease-in-out infinite, textFloat 4s ease-in-out infinite, textGlow 3s ease-in-out infinite',
                      transform: 'perspective(1000px) rotateX(15deg)',
                      transformStyle: 'preserve-3d'
                    }}>
                      {config.COMPANY_NAME.split(' ').slice(0, 2).join(' ')}
                    </span>
                    <span className="absolute inset-0 text-6xl font-black opacity-40 blur-md" style={{
                      background: 'linear-gradient(45deg, #ffffff, var(--primary-color), var(--primary-color-darker), var(--primary-color-darkest))',
                      WebkitBackgroundClip: 'text',
                      WebkitTextFillColor: 'transparent',
                      backgroundClip: 'text',
                      transform: 'translate(4px, 4px) perspective(1000px) rotateX(15deg)',
                      zIndex: -1,
                      animation: 'shadowFloat 4s ease-in-out infinite'
                    }}>
                      {config.COMPANY_NAME.split(' ').slice(0, 2).join(' ')}
                    </span>
                    <div className="absolute inset-0 overflow-hidden pointer-events-none">
                      <div className="absolute top-0 left-0 w-full h-full" style={{
                        background: 'radial-gradient(circle at 20% 20%, rgba(255, 255, 255, 0.3) 0%, transparent 50%), radial-gradient(circle at 80% 80%, var(--primary-color-rgba-04) 0%, transparent 50%)',
                        animation: 'particleMove 6s ease-in-out infinite'
                      }}></div>
                    </div>
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                      <div className="w-0 h-0 border-4 border-white/20 rounded-full animate-ping" style={{ animation: 'ripple 2s ease-out infinite' }}></div>
                    </div>
                  </h1>
                  <div className="w-24 h-1 bg-gradient-to-r from-white via-[var(--primary-color)] to-white mx-auto rounded-full"></div>
                  <h2 className="text-xl font-semibold text-white/90 mb-2">Portal Empresarial</h2>
                  <p className="text-sm text-white/70 font-medium">{config.COMPANY_NAME || config.COMPANY_NAME_LEGAL || ''}</p>
                </div>
              </>
            )}
          </div>
          
          {/* Card de login cu design glassmorphism ultra-modern */}
          <div className="relative">
            {/* Background blur effect */}
            <div className="absolute inset-0 bg-white/10 backdrop-blur-xl rounded-3xl border border-white/20 shadow-2xl"></div>
            
            {/* Content */}
            <div className="relative p-8">
              <div className="text-center mb-8">
                <h3 className="text-2xl font-bold text-white mb-2">Iniciar Sesión</h3>
                <p className="text-gray-400">Accede a tu cuenta empresarial</p>
              </div>

            <form className="space-y-6" onSubmit={handleSubmit}>
              {error && (
                  <div className="bg-red-500/20 border border-red-400/50 backdrop-blur-sm rounded-2xl p-4 animate-shake">
                  <div className="flex items-center">
                      <svg className="w-5 h-5 text-red-400 mr-3" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                    </svg>
                      <div className="text-sm text-red-300 font-medium">{error}</div>
                    </div>
                </div>
              )}
              
                <div className="space-y-5">
                  {/* Email Input - Redesignat */}
                  <div className="relative group">
                    <label htmlFor="login-email" className={`block text-sm font-medium mb-2 ${isClient2 ? 'text-gray-800 font-semibold' : 'text-gray-300'}`}>
                      Correo Electrónico
                    </label>
                    <div className="relative">
                      <div className="absolute inset-0 bg-gradient-to-r from-[var(--primary-color)]/20 to-purple-500/20 rounded-xl blur-sm group-focus-within:from-[var(--primary-color)]/30 group-focus-within:to-purple-400/30 transition-all duration-300"></div>
                      <input
                  id="login-email"
                  name="email"
                  type="email"
                  value={formData.email}
                  onChange={(e) => handleInputChange('email', e.target.value)}
                  required
                  autoComplete="email"
                        className="relative w-full px-4 py-3 bg-white/10 backdrop-blur-sm border border-white/20 rounded-xl text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[var(--primary-color)]/50 focus:border-[var(--primary-color)]/50 transition-all duration-300"
                        placeholder="tu@email.com"
                      />
                      <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                        <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 12a4 4 0 10-8 0 4 4 0 008 0zm0 0v1.5a2.5 2.5 0 005 0V12a9 9 0 10-9 9m4.5-1.206a8.959 8.959 0 01-4.5 1.207" />
                        </svg>
                      </div>
                    </div>
                  </div>
                  
                  {/* Password Input - Redesignat */}
                  <div className="relative group">
                    <label htmlFor="login-password" className={`block text-sm font-medium mb-2 ${isClient2 ? 'text-gray-800 font-semibold' : 'text-gray-300'}`}>
                      Contraseña
                    </label>
                    <div className="relative">
                      <div className="absolute inset-0 bg-gradient-to-r from-[var(--primary-color)]/20 to-purple-500/20 rounded-xl blur-sm group-focus-within:from-[var(--primary-color)]/30 group-focus-within:to-purple-400/30 transition-all duration-300"></div>
                      <input
                  id="login-password"
                  name="password"
                  type={showPassword ? "text" : "password"}
                  value={formData.password}
                  onChange={(e) => handleInputChange('password', e.target.value)}
                  required
                  autoComplete="current-password"
                        className="relative w-full px-4 py-3 pr-12 bg-white/10 backdrop-blur-sm border border-white/20 rounded-xl text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[var(--primary-color)]/50 focus:border-[var(--primary-color)]/50 transition-all duration-300"
                        placeholder="••••••••"
                      />
                      <button
                        type="button"
                        onClick={togglePasswordVisibility}
                        className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-white transition-colors duration-200 focus:outline-none"
                      >
                        {showPassword ? (
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.878 9.878L3 3m6.878 6.878L21 21" />
                          </svg>
                        ) : (
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                        </svg>
                        )}
                      </button>
                    </div>
                  </div>
              </div>
              
                {/* Terms text - Redesignat */}
                <div className="text-center">
                  <p className={`text-sm leading-relaxed ${isClient2 ? 'text-gray-800 font-medium' : 'text-gray-300'}`}>
                    Al iniciar sesión, estás de acuerdo con los <a href={`${config.EXTERNAL_SITE_URL}/es/terminos/`} target="_blank" rel="noopener noreferrer" className="text-[var(--primary-color)] hover:opacity-80 font-medium underline transition-colors duration-300">Términos y Condiciones</a>
                  </p>
                </div>
              
                {/* Login Button - Redesignat complet */}
                <button
                type="submit"
                disabled={loading}
                  className="group relative w-full overflow-hidden rounded-xl bg-gradient-to-r from-[var(--primary-color)] to-[var(--primary-color-darkest)] p-[2px] transition-all duration-300 hover:opacity-95 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                  <div className="relative flex items-center justify-center px-6 py-4 bg-gradient-to-r from-[var(--primary-color)] to-[var(--primary-color-darkest)] rounded-xl text-white font-semibold transition-all duration-300 group-hover:opacity-95">
                {loading ? (
                      <div className="flex items-center">
                        <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin mr-3"></div>
                        <span>Iniciando sesión...</span>
                      </div>
                    ) : (
                      <>
                        <span className="relative z-10">Iniciar Sesión</span>
                        <div className="absolute inset-0 bg-white/20 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                      </>
                    )}
                  </div>
                  {/* Shine effect cu animație customizată */}
                  <div className="absolute inset-0 -top-[50%] -left-[50%] w-[200%] h-[200%] bg-gradient-to-r from-transparent via-white/20 to-transparent rotate-45 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-700 animate-shimmer"></div>
                </button>

                {/* Mini-texto sobre ubicación */}
                <p className={`mt-3 text-xs text-center ${isClient2 ? 'text-gray-700 font-medium' : 'text-white/60'}`}>
                  📍 La ubicación se solicita al iniciar sesión y solo se utiliza al fichar.
                </p>

                {/* DEMO Button */}
                {!isDemoMode() && (
                  <div className="mt-4">
                    <div className="relative">
                      <div className="absolute inset-0 flex items-center">
                        <div className="w-full border-t border-white/20"></div>
                      </div>
                      <div className="relative flex justify-center text-sm">
                        <span className="px-4 bg-transparent text-white/70">o</span>
                      </div>
                    </div>
                    
                    <button
                      type="button"
                      onClick={handleDemoMode}
                      className="group relative w-full mt-4 overflow-hidden rounded-xl bg-gradient-to-r from-orange-500 to-yellow-600 p-[2px] transition-all duration-300 hover:from-orange-400 hover:to-yellow-500"
                    >
                      <div className="relative flex items-center justify-center px-6 py-3 bg-gradient-to-r from-orange-500 to-yellow-600 rounded-xl text-white font-semibold transition-all duration-300 group-hover:from-orange-400 group-hover:to-yellow-500">
                        <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                        </svg>
                        <span className="relative z-10">Conéctate como DEMO</span>
                        <div className="absolute inset-0 bg-white/20 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                      </div>
                      <div className="absolute inset-0 -top-[50%] -left-[50%] w-[200%] h-[200%] bg-gradient-to-r from-transparent via-white/20 to-transparent rotate-45 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-700"></div>
                    </button>
                    
                    <p className="mt-2 text-xs text-white/60 text-center">
                      Explora la aplicación con datos simulados
                    </p>
                  </div>
                )}
            </form>
            </div>
          </div>
          
          {/* Footer modernizat */}
          <div className="mt-8">
          <Footer />
          </div>
          
          {/* Copyright redesignat – HERA: negru bold pe fundal deschis; DeCamino: gri */}
          <div className="text-center mt-6">
            <div className={`inline-flex items-center flex-wrap justify-center gap-x-2 gap-y-1 text-xs ${isClient2 ? 'text-gray-900 font-bold' : 'text-gray-400'}`}>
              <span>© {new Date().getFullYear()}</span>
              <div className={`w-1 h-1 rounded-full ${isClient2 ? 'bg-gray-700' : 'bg-gray-400'}`}></div>
              <span>{config.COMPANY_NAME || config.COMPANY_NAME_LEGAL || ''}</span>
              <div className={`w-1 h-1 rounded-full ${isClient2 ? 'bg-gray-700' : 'bg-gray-400'}`}></div>
              <span>Sistema de gestión empresarial</span>
              <div className={`w-1 h-1 rounded-full ${isClient2 ? 'bg-gray-700' : 'bg-gray-400'}`}></div>
              <span className="font-mono">v{document.documentElement.getAttribute('data-version') || '—'}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Demo Modal */}
      <DemoModal 
        isOpen={showDemoModal} 
        onClose={() => setShowDemoModal(false)} 
      />
    </div>
  );
} 