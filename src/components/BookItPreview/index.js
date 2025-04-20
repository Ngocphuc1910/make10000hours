import React from 'react';
import styles from './styles.module.css';

const BookItPreview = ({ onClose }) => {
  return (
    <div className={styles.overlay}>
      <div className={styles.modal}>
        <div className={styles.header}>
          <button className={styles.closeButton} onClick={onClose}>
            ×
          </button>
          <h3>Book-it Preview</h3>
        </div>
        <div className={styles.content}>
          {/* Top Navigation Bar */}
          <div className={styles.navBar}>
            <div className={styles.statusBar}>
              <div className={styles.statusLeft}>
                <span>Zalopay</span>
              </div>
              <div className={styles.statusCenter}>
                <span>9:41 AM</span>
              </div>
              <div className={styles.statusRight}>
                <span>100%</span>
              </div>
            </div>
            <div className={styles.navBarContent}>
              <div className={styles.backButton}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M15 18L9 12L15 6" stroke="#001F3E" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </div>
              <div className={styles.title}>Đặt sân thể thao</div>
              <div className={styles.navControls}>
                <div className={styles.navControl}></div>
              </div>
            </div>
          </div>
          
          {/* User Profile Section */}
          <div className={styles.profileSection}>
            <div className={styles.profileInfo}>
              <div className={styles.avatar}>
                <div className={styles.avatarCircle}></div>
              </div>
              <div className={styles.userInfo}>
                <div className={styles.userName}>Ngọc Phúc</div>
                <div className={styles.userLocation}>VNG campus, số13, ph...</div>
              </div>
              <div className={styles.arrowIcon}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M9 18L15 12L9 6" stroke="#334C65" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </div>
            </div>
            <div className={styles.actionIcons}>
              <div className={styles.searchIcon}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M11 19C15.4183 19 19 15.4183 19 11C19 6.58172 15.4183 3 11 3C6.58172 3 3 6.58172 3 11C3 15.4183 6.58172 19 11 19Z" stroke="#66798B" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  <path d="M21 21L16.65 16.65" stroke="#66798B" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </div>
              <div className={styles.bellIcon}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M18 8C18 6.4087 17.3679 4.88258 16.2426 3.75736C15.1174 2.63214 13.5913 2 12 2C10.4087 2 8.88258 2.63214 7.75736 3.75736C6.63214 4.88258 6 6.4087 6 8C6 15 3 17 3 17H21C21 17 18 15 18 8Z" stroke="#66798B" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  <path d="M13.73 21C13.5542 21.3031 13.3019 21.5547 12.9982 21.7295C12.6946 21.9044 12.3504 21.9965 12 21.9965C11.6496 21.9965 11.3054 21.9044 11.0018 21.7295C10.6982 21.5547 10.4458 21.3031 10.27 21" stroke="#66798B" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </div>
            </div>
          </div>
          <div className={styles.separator}></div>
          
          {/* Main Sections */}
          <div className={styles.mainSection}>
            <div className={styles.sectionHeader}>
              <h4>Chưa có người chơi cùng?</h4>
            </div>
            
            {/* Card Group */}
            <div className={styles.cardGroup}>
              {/* Card 1 */}
              <div className={styles.card}>
                <div className={styles.cardImage}>
                  <div className={styles.badmintonIcon}></div>
                </div>
                <div className={styles.cardContent}>
                  <div className={styles.cardTitle}>Ghép nhóm</div>
                  <div className={styles.cardDescription}>Tìm người chơi cùng</div>
                </div>
              </div>
              
              {/* Card 2 */}
              <div className={styles.card}>
                <div className={styles.cardImage}></div>
                <div className={styles.cardContent}>
                  <div className={styles.cardTitle}>Vào nhóm sẵn có</div>
                  <div className={styles.cardDescription}>Tham gia chơi nhanh hơn</div>
                </div>
              </div>
            </div>
            
            {/* Courts Section */}
            <div className={styles.courtsSection}>
              <div className={styles.courtsSectionHeader}>
                <div className={styles.sectionTitle}>Đặt sân gần bạn ⚡️</div>
                <div className={styles.filterIcons}>
                  <div className={styles.filterIcon}>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path d="M22 3H2L10 12.46V19L14 21V12.46L22 3Z" stroke="#66798B" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  </div>
                  <div className={styles.sortIcon}>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path d="M4 6H13" stroke="#66798B" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                      <path d="M4 12H11" stroke="#66798B" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                      <path d="M4 18H11" stroke="#66798B" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                      <path d="M15 15L18 18L21 15" stroke="#66798B" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                      <path d="M18 6V18" stroke="#66798B" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  </div>
                </div>
              </div>
              
              {/* Filter Chips */}
              <div className={styles.filterChips}>
                <div className={`${styles.chip} ${styles.chipActive}`}>Tất cả</div>
                <div className={styles.chip}>Cầu lông</div>
                <div className={styles.chip}>Bóng đá</div>
                <div className={styles.chip}>Pickleball</div>
                <div className={styles.chip}>Tennis</div>
              </div>
              
              {/* Court Cards */}
              <div className={styles.courtCard}>
                <div className={styles.courtCardImage}></div>
                <div className={styles.courtCardContent}>
                  <div className={styles.courtCardTitle}>Sân Cầu Lông Tada Thanh Đa</div>
                  <div className={styles.courtCardLocation}>
                    <div className={styles.distance}>150m</div>
                    <div className={styles.address}>15 Bình Quới, Phường 27, Bình Thạnh...</div>
                  </div>
                  <div className={styles.courtCardFooter}>
                    <div className={styles.rating}>
                      <div className={styles.starIcon}>⭐</div>
                      <span>4.3 (67)</span>
                    </div>
                    <div className={styles.bookingCount}>5k lượt đặt</div>
                    <div className={styles.amenities}>
                      <div className={styles.amenityIcon}></div>
                      <div className={styles.amenityIcon}></div>
                      <div className={styles.amenityIcon}></div>
                    </div>
                  </div>
                </div>
                <div className={styles.bookmarkIcon}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M19 21L12 16L5 21V5C5 4.46957 5.21071 3.96086 5.58579 3.58579C5.96086 3.21071 6.46957 3 7 3H17C17.5304 3 18.0391 3.21071 18.4142 3.58579C18.7893 3.96086 19 4.46957 19 5V21Z" stroke="#66798B" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </div>
              </div>
              
              <div className={styles.courtCard}>
                <div className={styles.courtCardImage}></div>
                <div className={styles.courtCardContent}>
                  <div className={styles.courtCardTitle}>Sân Cầu Lông Bình Quới</div>
                  <div className={styles.courtCardLocation}>
                    <div className={styles.distance}>300m</div>
                    <div className={styles.address}>15 Bình Quới, Phường 27, Bình Thạnh...</div>
                  </div>
                  <div className={styles.courtCardFooter}>
                    <div className={styles.rating}>
                      <div className={styles.starIcon}>⭐</div>
                      <span>4.3 (67)</span>
                    </div>
                    <div className={styles.bookingCount}>5k lượt đặt</div>
                    <div className={styles.amenities}>
                      <div className={styles.amenityIcon}></div>
                      <div className={styles.amenityIcon}></div>
                      <div className={styles.amenityIcon}></div>
                    </div>
                  </div>
                </div>
                <div className={styles.bookmarkIcon}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M19 21L12 16L5 21V5C5 4.46957 5.21071 3.96086 5.58579 3.58579C5.96086 3.21071 6.46957 3 7 3H17C17.5304 3 18.0391 3.21071 18.4142 3.58579C18.7893 3.96086 19 4.46957 19 5V21Z" stroke="#66798B" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </div>
              </div>
            </div>
          </div>
          
          {/* Bottom Navigation */}
          <div className={styles.bottomNav}>
            <div className={styles.navItem}>
              <div className={styles.navIcon}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M10 3H3V10H10V3Z" stroke="#00CF6A" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  <path d="M21 3H14V10H21V3Z" stroke="#00CF6A" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  <path d="M21 14H14V21H21V14Z" stroke="#00CF6A" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  <path d="M10 14H3V21H10V14Z" stroke="#00CF6A" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </div>
              <span className={styles.navText}>Khám phá</span>
            </div>
            <div className={styles.navItem}>
              <div className={styles.navIcon}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M9 11L12 14L15 11" stroke="#66798B" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  <path d="M12 4V14" stroke="#66798B" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  <path d="M5 20H19" stroke="#66798B" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </div>
              <span className={styles.navText}>Quản lý lịch đặt</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default BookItPreview; 