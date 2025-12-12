// src/Login.jsx
import { useState } from "react";
import { auth, db } from "./firebase";
import { signInWithEmailAndPassword } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { useNavigate, Link } from "react-router-dom";
import logoImg from './logo.png';

const Login = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;
      const docRef = doc(db, "users", user.uid);
      const docSnap = await getDoc(docRef);

      if (docSnap.exists()) {
        const role = docSnap.data().role;
        if (role === "owner") navigate("/owner-dashboard");
        else if (role === "staff") navigate("/staff-dashboard");
        else if (role === "admin") navigate("/admin-dashboard");
      } else {
        alert("User record not found!");
      }
    } catch (error) {
      alert("Login Failed: " + error.message);
    }
    setLoading(false);
  };

  return (
    <div className="auth-container">
      <div className="auth-card">
        <div className="auth-header">
          {/* LOGO IMAGE HERE */}
          <img src={logoImg} alt="PawPals Logo" className="auth-logo-img" />
          
          <h2 style={{margin:0, color:"#333"}}>Welcome Back</h2>
          <p style={{margin:"5px 0 0", color:"#666"}}>PawPals Management System</p>
        </div>
        
        <form onSubmit={handleLogin} style={{ display: "flex", flexDirection: "column", gap: "15px" }}>
          <input type="email" placeholder="Email Address" onChange={(e) => setEmail(e.target.value)} required />
          <input type="password" placeholder="Password" onChange={(e) => setPassword(e.target.value)} required />
          
          <button 
            type="submit" 
            className="action-btn" 
            style={{ background: "#1565C0", color: "white", width: "100%", padding: "12px", marginTop: "10px" }}
            disabled={loading}
          >
            {loading ? "Connecting to your profile . . ." : "Login"}
          </button>
        </form>
        
        <Link to="/signup" className="auth-link">New Pet Owner? Register here</Link>
      </div>
    </div>
  );
};

export default Login;