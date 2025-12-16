import { useState, useRef, useEffect } from "react";

const TooltipInfo = ({ texto, titulo = "Información" }) => {
  const [visible, setVisible] = useState(false);
  const ref = useRef();

  // Închide tooltipul dacă dai click în afara lui
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (ref.current && !ref.current.contains(event.target)) {
        setVisible(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div className="relative inline-block" ref={ref}>
      <button
        type="button"
        onClick={() => setVisible(!visible)}
        className="text-blue-700 font-bold text-lg ml-2"
        aria-label="Mostrar ayuda"
      >
        ℹ️
      </button>

      {visible && (
        <div className="absolute left-full top-1/2 transform -translate-y-1/2 ml-2 w-80 p-4 rounded-lg shadow-xl bg-red-600 text-white text-sm z-[9999] border-2 border-white">
          <div className="flex justify-between items-start mb-2">
            <h4 className="font-bold text-base">{titulo}</h4>
            <div
              onClick={() => setVisible(false)}
              className="text-white hover:text-gray-200 text-lg font-bold ml-2 cursor-pointer"
            >
              ×
            </div>
          </div>
          <div className="text-sm leading-relaxed">
            {texto}
          </div>
        </div>
      )}
    </div>
  );
};

export default TooltipInfo;
