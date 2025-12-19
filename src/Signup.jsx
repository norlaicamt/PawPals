// src/Signup.jsx
import { useState } from "react";
import { auth, db } from "./firebase";
import { createUserWithEmailAndPassword } from "firebase/auth";
import { doc, setDoc } from "firebase/firestore";
import { useNavigate, Link } from "react-router-dom";
import logoImg from "./assets/logo.png";


const Signup = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [fname, setFname] = useState("");
  const [lname, setLname] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleSignup = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;
      await setDoc(doc(db, "users", user.uid), {
        firstName: fname, lastName: lname, email: email, role: "owner", createdAt: new Date()
      });
      alert("Account successfully created. Signing you in . . .");
      navigate("/owner-dashboard");
    } catch (error) {
      alert("Signup Failed: " + error.message);
    }
    setLoading(false);
  };

  return (
    <div className="auth-container">
      <div className="auth-card" style={{maxWidth: "500px", position: "relative"}}>
        
        {/* ADDED BACK BUTTON */}
        <button 
          onClick={() => navigate("/")} 
          style={{
            position: "absolute",
            top: "15px",
            left: "15px",
            background: "none",
            border: "none",
            cursor: "pointer",
            color: "#666",
            display: "flex",
            alignItems: "center",
            fontSize: "14px",
            fontWeight: "bold"
          }}
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{marginRight: "5px"}}><line x1="19" y1="12" x2="5" y2="12"></line><polyline points="12 19 5 12 12 5"></polyline></svg>
          Back
        </button>

        <div className="auth-header" style={{marginTop: "20px"}}>
          <img src={logoImg} alt="PawPals Logo" className="auth-logo-img" />
          
          <h1 style={{margin:0, color:"#333", fontSize: "2rem"}}>PawPals</h1>
          <h2 style={{margin:"10px 0 5px", color:"#444"}}>Join Our Community</h2>
          <p style={{margin:"5px 0 20px", color:"#666", lineHeight: "1.5"}}>
            Create an account to easily manage your pet's health records and book appointments online.
          </p>
        </div>
        
        <form onSubmit={handleSignup} style={{ display: "flex", flexDirection: "column", gap: "15px" }}>
          <div style={{ display: "flex", gap: "10px" }}>
            <input type="text" placeholder="First Name" onChange={(e) => setFname(e.target.value)} required />
            <input type="text" placeholder="Last Name" onChange={(e) => setLname(e.target.value)} required />
          </div>
          <input type="email" placeholder="Email Address" onChange={(e) => setEmail(e.target.value)} required />
          
          <div style={{ position: "relative", display: "flex", alignItems: "center" }}>
            <input 
              type={showPassword ? "text" : "password"} 
              placeholder="Password" 
              onChange={(e) => setPassword(e.target.value)} 
              required 
              style={{ width: "100%", paddingRight: "40px" }}
            />
            <button
              type="button" 
              onClick={() => setShowPassword(!showPassword)}
              style={{
                position: "absolute",
                right: "10px",
                background: "none",
                border: "none",
                cursor: "pointer",
                color: "#666",
                padding: "0",
                display: "flex",
                alignItems: "center"
              }}
            >
              {showPassword ? (
                 <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path><line x1="1" y1="1" x2="23" y2="23"></line></svg>
              ) : (
                 <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>
              )}
            </button>
          </div>

          <button 
            type="submit" 
            className="action-btn" 
            style={{ background: "#4CAF50", color: "white", width: "100%", padding: "12px", marginTop: "10px" }}
            disabled={loading}
          >
            {loading ? "Creating your account . . ." : "Create Account"}
          </button>
        </form>

        <p style={{marginTop: "20px", fontSize: "14px", color: "#666"}}>
            Already have an account? <br/>
            <Link to="/login" className="auth-link" style={{marginTop: "5px"}}>Login here</Link>
        </p>
      </div>
    </div>
  );
};

export default Signup;