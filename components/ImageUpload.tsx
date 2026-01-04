
import React, { useCallback, useState } from 'react';

interface ImageUploadProps {
  onImagesChange: (base64s: string[]) => void;
  selectedImages: string[];
  compact?: boolean;
}

export const ImageUpload: React.FC<ImageUploadProps> = ({ onImagesChange, selectedImages, compact = false }) => {
  const [isDragging, setIsDragging] = useState(false);

  const processFiles = (files: FileList | null) => {
    if (!files || files.length === 0) return;

    const newImages: string[] = [];
    let processedCount = 0;
    const totalFiles = files.length;

    Array.from(files).forEach((file) => {
      if (file.type.startsWith('image/')) {
        const reader = new FileReader();
        reader.onload = (e) => {
          if (e.target?.result) {
            newImages.push(e.target.result as string);
          }
          processedCount++;
          
          // Only trigger when ALL files in the batch have been processed
          if (processedCount === totalFiles) {
             if (newImages.length > 0) {
                 onImagesChange([...selectedImages, ...newImages]);
             }
          }
        };
        reader.readAsDataURL(file);
      } else {
        // Non-image files count as processed but aren't added
        processedCount++;
        if (processedCount === totalFiles) {
             if (newImages.length > 0) {
                 onImagesChange([...selectedImages, ...newImages]);
             }
        }
      }
    });
  };

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    processFiles(e.dataTransfer.files);
  }, [selectedImages, onImagesChange]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    processFiles(e.target.files);
    // Reset value so same files can be selected again if needed
    e.target.value = '';
  };

  const removeImage = (index: number) => {
    const newImages = selectedImages.filter((_, i) => i !== index);
    onImagesChange(newImages);
  };

  return (
    <div className="w-full h-full flex flex-col">
      <div className="flex items-center justify-between mb-2">
        <h2 className={`font-semibold text-slate-200 flex items-center gap-2 ${compact ? 'text-sm' : 'text-lg'}`}>
            {!compact && <span className="w-6 h-6 rounded-full bg-slate-700 text-xs flex items-center justify-center">1</span>}
            {compact ? 'Reference Image' : 'Upload Products'}
        </h2>
        {selectedImages.length > 0 && (
            <span className="px-2 py-1 bg-indigo-500/20 text-indigo-300 text-[10px] rounded-full font-medium border border-indigo-500/30">
                {selectedImages.length} {selectedImages.length === 1 ? 'img' : 'imgs'}
            </span>
        )}
      </div>
      
      {/* Upload Area */}
      <div
        className={`relative rounded-2xl border-2 border-dashed transition-all duration-300 flex flex-col items-center justify-center cursor-pointer overflow-hidden group
          ${selectedImages.length > 0 
            ? (compact ? 'h-24 mb-2' : 'h-32 mb-4') 
            : (compact ? 'flex-1 min-h-[100px]' : 'flex-1 min-h-[300px]')
          }
          ${isDragging 
            ? 'border-indigo-500 bg-indigo-500/10' 
            : 'border-slate-700 hover:border-slate-500 hover:bg-slate-800/50 bg-slate-900'
          }
        `}
        onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
        onClick={() => document.getElementById('file-upload')?.click()}
      >
        <input
          id="file-upload"
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={handleChange}
        />

        <div className="text-center pointer-events-none p-4">
            {selectedImages.length === 0 ? (
                <>
                    <div className={`${compact ? 'w-8 h-8' : 'w-16 h-16'} rounded-full bg-slate-800 flex items-center justify-center mx-auto ${compact ? 'mb-2' : 'mb-4'} text-slate-400 group-hover:scale-110 transition-transform duration-300`}>
                    <svg className={`${compact ? 'w-4 h-4' : 'w-8 h-8'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                    </div>
                    <p className={`text-slate-300 font-medium ${compact ? 'text-xs' : 'text-lg'}`}>
                      {compact ? 'Drop image here' : 'Drop product images here'}
                    </p>
                    {!compact && <p className="text-slate-500 text-sm mt-2">or click to browse multiple files</p>}
                </>
            ) : (
                <div className="flex items-center gap-3 justify-center text-slate-400">
                    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                    <span>Add more</span>
                </div>
            )}
        </div>
      </div>

      {/* Thumbnails Grid */}
      {selectedImages.length > 0 && (
          <div className={`grid grid-cols-3 sm:grid-cols-4 gap-2 overflow-y-auto pr-2 custom-scrollbar ${compact ? 'max-h-[100px]' : 'max-h-[300px]'}`}>
              {selectedImages.map((img, idx) => (
                  <div key={idx} className="relative group aspect-square rounded-lg border border-slate-700 bg-slate-800 overflow-hidden">
                      <img src={img} alt={`Product ${idx + 1}`} className="w-full h-full object-cover" />
                      <button
                        onClick={(e) => { e.stopPropagation(); removeImage(idx); }}
                        className="absolute top-1 right-1 w-5 h-5 rounded-full bg-red-500/80 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-600"
                        title="Remove image"
                      >
                          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                      </button>
                  </div>
              ))}
          </div>
      )}
    </div>
  );
};
