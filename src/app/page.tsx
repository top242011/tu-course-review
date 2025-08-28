'use client';

import { useState, useEffect, FormEvent, ChangeEvent } from 'react';
import { supabase } from '../../lib/supabaseClient';

// ** IMPORTANT: Replace with your Google API Key for Perspective API **
const GOOGLE_API_KEY = 'AIzaSyCI0__q0lCKHv4E1Dly8Y_Exa4Lyz_BFmQ';

// Define the types for your data
type Review = {
  id: number;
  course_id: number;
  rating: number;
  text: string;
  helpful_votes: number;
  reported_times: number;
  created_at: string;
};

type Course = {
  id: number;
  name: string;
  code: string;
  faculty: string;
  professor: string;
  reviews: Review[];
  avgRating?: string | number;
};

export default function HomePage() {
  const [view, setView] = useState('home');
  const [courses, setCourses] = useState<Course[]>([]);
  const [currentCourse, setCurrentCourse] = useState<Course | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    fetchCourses();
  }, []);

  async function fetchCourses() {
    setLoading(true);
    setError(null);
    try {
      const { data, error } = await supabase.from('courses').select('*, reviews(*)');
      if (error) throw error;
      setCourses(data as Course[]);
    } catch (err) {
      console.error('Error fetching courses:', err);
      setError('เกิดข้อผิดพลาดในการโหลดข้อมูล');
    } finally {
      setLoading(false);
    }
  }

  const handleSearch = () => {
    setView('search');
  };

  const handleShowCourseProfile = (courseId: number) => {
    const selectedCourse = courses.find(c => c.id === courseId);
    if (selectedCourse) {
      setCurrentCourse(selectedCourse);
      setView('course-profile');
    }
  };

  const handleAddCourse = async (e: FormEvent) => {
    e.preventDefault();
    const formData = new FormData(e.target as HTMLFormElement);
    const newCourse = {
      name: formData.get('course-name') as string,
      code: formData.get('course-code') as string,
      faculty: formData.get('course-faculty') as string,
      professor: formData.get('course-professor') as string,
    };
    try {
      const { error } = await supabase.from('courses').insert([newCourse]);
      if (error) throw error;
      alert('เพิ่มวิชาใหม่เรียบร้อยแล้ว!');
      (e.target as HTMLFormElement).reset();
      await fetchCourses();
      setView('home');
    } catch (err) {
      console.error('Error adding new course:', err);
      alert('เกิดข้อผิดพลาดในการเพิ่มวิชาใหม่');
    }
  };

  const handleReviewSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const formData = new FormData(e.target as HTMLFormElement);
    const rating = parseInt(formData.get('rating') as string);
    const text = formData.get('review-text') as string;

    try {
      const isHateSpeech = await checkHateSpeech(text);
      if (isHateSpeech) {
        alert('รีวิวของคุณมีเนื้อหาที่ไม่เหมาะสม กรุณาแก้ไขก่อนโพสต์');
        return;
      }
      
      if (!currentCourse) return;
      const { error } = await supabase.from('reviews').insert([{
        course_id: currentCourse.id,
        rating,
        text
      }]);
      if (error) throw error;
      alert('ส่งรีวิวเรียบร้อยแล้ว!');
      await fetchCourses();
      handleShowCourseProfile(currentCourse.id);
    } catch (err) {
      console.error('Error submitting review:', err);
      alert('เกิดข้อผิดพลาดในการส่งรีวิว');
    }
  };

  const checkHateSpeech = async (text: string): Promise<boolean> => {
    try {
      const response = await fetch(`https://commentanalyzer.googleapis.com/v1alpha1/comments:analyze?key=${GOOGLE_API_KEY}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          comment: { text: text },
          languages: ['th', 'en'],
          requestedAttributes: { TOXICITY: {} }
        })
      });
      const data = await response.json();
      const toxicityScore = data.attributeScores.TOXICITY.summaryScore.value;
      return toxicityScore > 0.7;
    } catch (error) {
      console.error('Error checking hate speech:', error);
      return false;
    }
  };

  const incrementHelpfulVotes = async (reviewId: number) => {
    try {
      const { error } = await supabase.rpc('increment_helpful_votes', { review_id_param: reviewId });
      if (error) throw error;
      alert('ขอบคุณสำหรับโหวต!');
      await fetchCourses();
      if (currentCourse) handleShowCourseProfile(currentCourse.id);
    } catch (err) {
      console.error('Error incrementing helpful votes:', err);
      alert('เกิดข้อผิดพลาดในการโหวต');
    }
  };

  const incrementReportedTimes = async (reviewId: number) => {
    try {
      const { error } = await supabase.rpc('increment_reported_times', { review_id_param: reviewId });
      if (error) throw error;
      alert('รับทราบการรายงานแล้ว! หากรีวิวนี้ถูกรายงานครบ 5 ครั้ง จะถูกซ่อนอัตโนมัติ');
      await fetchCourses();
      if (currentCourse) handleShowCourseProfile(currentCourse.id);
    } catch (err) {
      console.error('Error reporting review:', err);
      alert('เกิดข้อผิดพลาดในการรายงาน');
    }
  };

  const getAvgRating = (reviews: Review[] | undefined) => {
    if (!reviews || reviews.length === 0) return 'ยังไม่มี';
    const totalRating = reviews.reduce((sum, review) => sum + review.rating, 0);
    return (totalRating / reviews.length).toFixed(1);
  };

  const renderHomeView = () => {
    const popularCourses = [...courses].sort((a, b) => b.reviews.length - a.reviews.length).slice(0, 3);
    const latestReviews = [...courses].flatMap(c => c.reviews.map(r => ({ ...r, courseName: c.name, courseId: c.id }))).sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()).slice(0, 3);

    return (
      <>
        <section className="text-center py-12 md:py-24">
          <h1 className="text-3xl md:text-5xl font-extrabold text-gray-800 leading-tight mb-4">ค้นหา รีวิว และเลือกวิชาที่ใช่สำหรับคุณ</h1>
          <p className="text-lg text-gray-600 mb-8">ฐานข้อมูลรีวิววิชาเรียนที่สร้างโดยนักศึกษาธรรมศาสตร์</p>
          <div className="max-w-xl mx-auto flex items-center bg-white rounded-full shadow-lg p-2">
            <input type="text" id="search-input" className="w-full px-6 py-3 text-gray-700 rounded-full focus:outline-none" placeholder="ค้นหาวิชาจากชื่อ, รหัส, หรืออาจารย์..." value={searchTerm} onChange={(e: ChangeEvent<HTMLInputElement>) => setSearchTerm(e.target.value)} />
            <button onClick={handleSearch} className="bg-tu-dark-blue-600 text-white rounded-full px-8 py-3 text-sm font-semibold hover:bg-tu-dark-blue-700 transition-colors duration-200">ค้นหา</button>
          </div>
        </section>
        
        <section className="mt-12">
          <h2 className="text-2xl font-bold text-gray-800 mb-4">วิชายอดนิยม</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {loading ? <p className="text-center text-gray-500">กำลังโหลดข้อมูล...</p> : popularCourses.map(course => (
              <div key={course.id} onClick={() => handleShowCourseProfile(course.id)} className="bg-white rounded-2xl shadow-lg p-6 hover:shadow-xl transform hover:-translate-y-1 transition-all duration-300 cursor-pointer">
                <div className="flex justify-between items-center mb-2">
                  <h3 className="text-lg font-bold text-gray-800">{course.name}</h3>
                  <span className="bg-yellow-400 text-yellow-800 text-sm font-bold px-3 py-1 rounded-full">{getAvgRating(course.reviews)} / 5</span>
                </div>
                <p className="text-gray-500 text-sm mb-2">รหัสวิชา: {course.code} | คณะ: {course.faculty}</p>
                <p className="text-gray-600 text-sm">{course.reviews.length} รีวิว</p>
              </div>
            ))}
          </div>
        </section>

        <section className="mt-12">
          <h2 className="text-2xl font-bold text-gray-800 mb-4">รีวิวล่าสุด</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {loading ? <p className="text-center text-gray-500">กำลังโหลดข้อมูล...</p> : latestReviews.map(review => (
              <div key={review.id} className="bg-white rounded-2xl shadow-lg p-6">
                <p className="text-gray-600 italic mb-2">"{review.text.substring(0, 60)}..."</p>
                <p className="text-sm font-semibold text-gray-800">โดย ผู้ใช้ {review.id}</p>
                <p className="text-xs text-gray-500 mt-1">วิชา: <span className="text-tu-dark-blue-600 font-bold cursor-pointer" onClick={() => handleShowCourseProfile(review.courseId)}>{review.courseName}</span></p>
              </div>
            ))}
          </div>
        </section>
      </>
    );
  };

  const renderSearchResults = () => {
    const filteredCourses = courses.filter(course =>
      course.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      course.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (course.professor && course.professor.toLowerCase().includes(searchTerm.toLowerCase()))
    );

    return (
      <>
        <h2 className="text-3xl font-bold text-gray-800 mb-6">ผลการค้นหา</h2>
        <div className="space-y-4">
          {filteredCourses.length === 0 ? (
            <p className="text-center text-gray-500">ไม่พบผลการค้นหา</p>
          ) : (
            filteredCourses.map(course => (
              <div key={course.id} onClick={() => handleShowCourseProfile(course.id)} className="bg-white rounded-2xl p-6 shadow-lg hover:shadow-xl transform hover:-translate-y-1 transition-all duration-300 cursor-pointer">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-xl font-bold text-gray-800">{course.name}</h3>
                  <span className="bg-yellow-400 text-yellow-800 text-sm font-bold px-3 py-1 rounded-full">{getAvgRating(course.reviews)} / 5</span>
                </div>
                <p className="text-gray-500 text-sm mb-2">รหัสวิชา: {course.code} | อาจารย์: {course.professor}</p>
                <p className="text-gray-600 text-sm">{course.reviews.length} รีวิว</p>
              </div>
            ))
          )}
        </div>
      </>
    );
  };

  const renderCourseProfile = () => {
    if (!currentCourse) return null;
    const reviews = currentCourse.reviews.filter(r => r.reported_times < 5).sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    
    return (
      <>
        <button onClick={() => setView('home')} className="flex items-center text-gray-600 hover:text-tu-light-blue-600 mb-4 transition-colors duration-200">
          <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7"></path>
          </svg>
          กลับ
        </button>
        <div className="bg-white p-6 md:p-8 rounded-2xl shadow-lg mb-6">
          <div className="flex justify-between items-start mb-4">
            <div>
              <h2 className="text-3xl font-bold text-gray-800 mb-2">{currentCourse.name}</h2>
              <p className="text-gray-500 text-lg">รหัสวิชา: {currentCourse.code} | อาจารย์: {currentCourse.professor}</p>
            </div>
            <div className="text-right">
              <span className="bg-yellow-400 text-yellow-800 text-xl font-bold px-4 py-2 rounded-full">{getAvgRating(currentCourse.reviews)} / 5</span>
              <p className="text-gray-500 text-sm mt-1">{currentCourse.reviews.length} รีวิว</p>
            </div>
          </div>
          <hr className="my-4" />
          <div className="text-gray-700">
            <h4 className="font-semibold text-lg mb-2">คำอธิบายรายวิชา (จำลอง)</h4>
            <p>วิชานี้จะครอบคลุมเนื้อหาสำคัญในสาขาวิชา {currentCourse.name} โดยเน้นการประยุกต์ใช้ในชีวิตจริงและงานวิจัยที่เกี่ยวข้อง</p>
          </div>
        </div>
        
        <div className="mt-8">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-2xl font-bold text-gray-800">รีวิววิชา</h3>
            <button onClick={() => setView('review-modal')} className="bg-tu-light-blue-500 text-white px-6 py-2 rounded-full font-semibold hover:bg-tu-light-blue-600 transition-colors duration-200">เขียนรีวิว</button>
          </div>
          <div className="space-y-6">
            {reviews.length === 0 ? (
              <p className="text-center text-gray-500">ยังไม่มีรีวิวสำหรับวิชานี้</p>
            ) : (
              reviews.map(review => (
                <div key={review.id} className="bg-gray-50 p-6 rounded-xl border border-gray-200">
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <p className="font-bold text-gray-800">ผู้ใช้ {review.id}</p>
                      <p className="text-xs text-gray-500">คะแนน: {review.rating} / 5</p>
                    </div>
                  </div>
                  <p className="text-gray-700">{review.text}</p>
                  <div className="flex justify-between items-center mt-4">
                    <button onClick={() => incrementHelpfulVotes(review.id)} className="text-blue-500 hover:text-blue-700 text-sm">เป็นประโยชน์ ({review.helpful_votes})</button>
                    <button onClick={() => incrementReportedTimes(review.id)} className="text-red-500 hover:text-red-700 text-sm">รายงาน ({review.reported_times})</button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </>
    );
  };

  const renderAddCourseView = () => (
    <div className="max-w-lg mx-auto bg-white p-8 md:p-12 rounded-2xl shadow-lg">
      <h2 className="text-3xl font-bold text-gray-800 mb-6 text-center">เพิ่มวิชาใหม่</h2>
      <form onSubmit={handleAddCourse}>
        <div className="mb-4">
          <label htmlFor="course-name" className="block text-gray-700 font-semibold mb-2">ชื่อวิชา</label>
          <input type="text" id="course-name" name="course-name" className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" required />
        </div>
        <div className="mb-4">
          <label htmlFor="course-code" className="block text-gray-700 font-semibold mb-2">รหัสวิชา</label>
          <input type="text" id="course-code" name="course-code" className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" required />
        </div>
        <div className="mb-4">
          <label htmlFor="course-faculty" className="block text-gray-700 font-semibold mb-2">คณะ/วิชาศึกษาทั่วไป</label>
          <input type="text" id="course-faculty" name="course-faculty" className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>
        <div className="mb-6">
          <label htmlFor="course-professor" className="block text-gray-700 font-semibold mb-2">อาจารย์ผู้สอน</label>
          <input type="text" id="course-professor" name="course-professor" className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>
        <button type="submit" className="w-full bg-tu-dark-blue-600 text-white py-3 rounded-full font-bold text-lg hover:bg-tu-dark-blue-700 transition-colors duration-200">เพิ่มวิชา</button>
      </form>
    </div>
  );

  const renderLoginView = () => (
    <div className="max-w-lg mx-auto bg-white p-8 md:p-12 rounded-2xl shadow-lg">
      <h2 className="text-3xl font-bold text-gray-800 mb-6 text-center">เข้าสู่ระบบ</h2>
      <p className="text-center text-gray-500 mb-6">ระบบนี้ยังอยู่ในระหว่างการพัฒนา</p>
    </div>
  );

  const renderReviewModal = () => (
    <div className="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-2xl p-8 w-full max-w-lg shadow-2xl">
        <div className="flex justify-between items-center mb-6">
          <h3 className="text-2xl font-bold text-gray-800">เขียนรีวิววิชา</h3>
          <button onClick={() => setView(currentCourse ? 'course-profile' : 'home')} className="text-gray-500 hover:text-gray-700 transition-colors duration-200">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path>
            </svg>
          </button>
        </div>
        <form onSubmit={handleReviewSubmit}>
          <div className="mb-4">
            <label className="block text-gray-700 font-semibold mb-2">ให้คะแนน</label>
            <input type="number" id="rating" name="rating" min="1" max="5" className="w-full px-4 py-2 border rounded-lg" placeholder="1-5" required />
          </div>
          <div className="mb-6">
            <label htmlFor="review-text" className="block text-gray-700 font-semibold mb-2">รีวิว</label>
            <textarea id="review-text" name="review-text" rows={4} className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" required placeholder="เขียนประสบการณ์ของคุณเกี่ยวกับวิชานี้..."></textarea>
          </div>
          <button type="submit" className="w-full bg-tu-light-blue-500 text-white py-3 rounded-full font-bold text-lg hover:bg-tu-light-blue-600 transition-colors duration-200">ส่งรีวิว</button>
        </form>
      </div>
    </div>
  );

  return (
    <div className="bg-gray-100 min-h-screen flex flex-col">
      <header className="bg-white shadow-md p-4 sticky top-0 z-50">
        <nav className="container mx-auto flex justify-between items-center">
          <div className="flex items-center">
            <a href="#" className="text-2xl font-bold text-tu-dark-blue-600" onClick={() => setView('home')}>TU Reviews</a>
          </div>
          <div className="hidden md:flex items-center space-x-6">
            <a href="#" className="text-gray-600 hover:text-tu-light-blue-600 transition-colors duration-200" onClick={() => setView('home')}>หน้าแรก</a>
            <a href="#" className="px-4 py-2 text-white rounded-full bg-green-500 hover:bg-green-600 transition-colors duration-200 shadow-lg" onClick={() => setView('add-course')}>เพิ่มวิชาใหม่</a>
            <a href="#" className="px-4 py-2 bg-tu-dark-blue-600 text-white rounded-full hover:bg-tu-dark-blue-700 transition-colors duration-200 shadow-lg" onClick={() => setView('login')}>เข้าสู่ระบบ</a>
          </div>
        </nav>
      </header>

      <main className="flex-grow container mx-auto p-4 md:p-8">
        {view === 'home' && renderHomeView()}
        {view === 'search' && renderSearchResults()}
        {view === 'course-profile' && renderCourseProfile()}
        {view === 'add-course' && renderAddCourseView()}
        {view === 'login' && renderLoginView()}
        {view === 'review-modal' && renderReviewModal()}
      </main>

      <footer className="bg-gray-800 text-white text-center p-4 mt-8">
        <p>&copy; 2024 TU Reviews. All Rights Reserved.</p>
      </footer>
    </div>
  );
}
