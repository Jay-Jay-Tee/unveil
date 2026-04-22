import { useEffect, useRef } from 'react';

/**
 * ConfettiCanvas - Simple confetti animation on canvas
 * Triggered when user clicks "Start Auditing" or major CTAs
 */
export default function ConfettiCanvas() {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    const width = (canvas.width = window.innerWidth);
    const height = (canvas.height = window.innerHeight);

    // Confetti particles
    const particles = [];
    const particleCount = 50;

    // Colors matching design system
    const colors = ['#FF6B5B', '#1FCEC6', '#FFA500', '#CAFF00', '#00D99F', '#FFE8E4'];

    class Particle {
      constructor() {
        this.x = Math.random() * width;
        this.y = -10;
        this.velocity = {
          x: (Math.random() - 0.5) * 8,
          y: Math.random() * 3 + 2,
        };
        this.alpha = 1;
        this.decay = Math.random() * 0.015 + 0.015;
        this.color = colors[Math.floor(Math.random() * colors.length)];
        this.size = Math.random() * 6 + 2;
      }

      update() {
        this.velocity.y += 0.1; // gravity
        this.velocity.x *= 0.99; // air resistance
        this.x += this.velocity.x;
        this.y += this.velocity.y;
        this.alpha -= this.decay;
      }

      draw() {
        ctx.save();
        ctx.globalAlpha = this.alpha;
        ctx.fillStyle = this.color;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
    }

    // Create initial particles
    for (let i = 0; i < particleCount; i++) {
      particles.push(new Particle());
    }

    // Animation loop
    let animationId;
    const animate = () => {
      ctx.clearRect(0, 0, width, height);

      for (let i = particles.length - 1; i >= 0; i--) {
        particles[i].update();
        particles[i].draw();

        // Remove dead particles
        if (particles[i].alpha <= 0) {
          particles.splice(i, 1);
        }
      }

      if (particles.length > 0) {
        animationId = requestAnimationFrame(animate);
      }
    };

    animate();

    // Handle window resize
    const handleResize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };

    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      cancelAnimationFrame(animationId);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="fixed top-0 left-0 w-full h-full pointer-events-none z-50"
    />
  );
}
