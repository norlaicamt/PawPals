// src/Home.jsx
import React from 'react';
import { useNavigate } from 'react-router-dom';
import logoImg from "./assets/logo.png";

const Home = () => {
  const navigate = useNavigate();

  return (
    <div className="home-container">

      {/* --- NAVBAR --- */}
      <nav 
        className="navbar" 
        style={{ position: 'fixed', width: '100%', top: 0, boxSizing: 'border-box', zIndex: 1000 }}
      >
        <div className="logo">
          <img src={logoImg} alt="PawPals" className="logo-img" />
          PawPals Hub
        </div>

        <div className="nav-buttons">
          <button
            onClick={() => navigate('/login')}
            className="action-btn"
            style={{ background: 'transparent', color: '#2196F3', border: '2px solid #2196F3' }}
          >
            Login
          </button>

          <button
            onClick={() => navigate('/signup')}
            className="action-btn"
            style={{ background: '#2196F3', color: 'white' }}
          >
            Sign Up
          </button>
        </div>
      </nav>

      {/* --- HERO SECTION --- */}
      <header className="hero-section">
        <div className="hero-content">
          <h1>Where Every Pet Matters, Every Time.</h1>
          <p>
            Book appointments, track medical records, and chat with our expert staff—
            all in one place.
          </p>

          <button
            onClick={() => navigate('/login')}
            className="hero-btn"
          >
            Book an Appointment Now
          </button>
        </div>

        <div className="hero-image">
          <span>🐶</span>
        </div>
      </header>

      {/* --- SERVICES SECTION --- */}
      <section className="services-section">
        <h2>Our Services</h2>

        <div className="card-grid">
          <div className="card">
            <div className="card-icon">🩺</div>
            <h3>Check-ups</h3>
            <p>Comprehensive health exams to keep your pet happy and healthy.</p>
          </div>

          <div className="card">
            <div className="card-icon">💉</div>
            <h3>Vaccinations</h3>
            <p>Protect your furry friends from common diseases and illnesses.</p>
          </div>
        </div>
      </section>

      {/* --- FOOTER --- */}
      <footer className="footer">
        <p>© 2025 Marawi Veterinary Clinic. All rights reserved.</p>
      </footer>

    </div>
  );
};

export default Home;
