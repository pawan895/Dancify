import React from 'react';
import { Routes, Route,} from 'react-router-dom';
import Home from './Pages/Home'
import About from './Pages/About'
import Contact from './Pages/Contact'
import NavBar from './Components/NavBar';
import Levels from './Pages/Levels';
import Level1 from './Pages/Level1'

function App() {
  return (
   
    <>
      <NavBar />   
      <Routes>
        <Route exact path="/" element={<Home />} />
        <Route path="/about" element={<About />} />
        <Route path="/contact" element={<Contact />} />
        <Route path= "/levels" element={<Levels />}/>
        <Route path='/level/:id' element={<Level1 />} />
      </Routes>
    </>

  );
}

export default App