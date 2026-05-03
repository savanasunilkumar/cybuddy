import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import { apiService } from './api';
import { cloudflareTTSService } from './cloudflareTTS';

interface DescribePayload {
  description: string;
}

export type DescribeStage = 'idle' | 'capturing' | 'processing' | 'speaking' | 'error';

interface DescribeResult {
  description: string;
  cancelled: boolean;
}

class CameraDescribeService {
  private cancelRequested = false;

  // Send an already-captured base64 JPEG to the backend, get a description,
  // and (optionally) speak it. Used by the live Vision screen which captures
  // frames from the in-app camera preview directly.
  async describeImageBase64(
    base64: string,
    options?: { speak?: boolean; prompt?: string }
  ): Promise<string> {
    const speak = options?.speak !== false;

    const data = await apiService.post<DescribePayload>(
      '/api/voice/describe',
      {
        imageBase64: base64,
        mimeType: 'image/jpeg',
        prompt: options?.prompt,
      },
      { timeout: 60000 }
    );

    const description = data?.description?.trim();
    if (!description) {
      throw new Error('Empty description from backend');
    }

    if (speak) {
      try {
        await cloudflareTTSService.speak(description);
      } catch (ttsError) {
        console.error('TTS error during describe:', ttsError);
      }
    }

    return description;
  }

  // Single end-to-end action: open camera → resize → describe → speak.
  // Caller passes an onStage callback so the UI can render state without
  // owning the orchestration.
  async captureAndDescribe(onStage?: (stage: DescribeStage) => void): Promise<DescribeResult> {
    this.cancelRequested = false;

    try {
      const cameraPermission = await ImagePicker.requestCameraPermissionsAsync();
      if (!cameraPermission.granted) {
        throw new Error('Camera permission denied — enable it in Settings to use scene description.');
      }

      onStage?.('capturing');

      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        quality: 0.85,
        allowsEditing: false,
        exif: false,
      });

      if (result.canceled || !result.assets || result.assets.length === 0) {
        onStage?.('idle');
        return { description: '', cancelled: true };
      }

      const asset = result.assets[0];

      onStage?.('processing');

      // Resize to a max dimension of 1024px to keep upload + vision cost
      // reasonable. Force JPEG so the backend doesn't have to sniff format.
      const manipulated = await ImageManipulator.manipulateAsync(
        asset.uri,
        [{ resize: { width: 1024 } }],
        {
          compress: 0.85,
          format: ImageManipulator.SaveFormat.JPEG,
          base64: true,
        }
      );

      if (!manipulated.base64) {
        throw new Error('Image manipulator returned no base64 data');
      }

      if (this.cancelRequested) {
        onStage?.('idle');
        return { description: '', cancelled: true };
      }

      const data = await apiService.post<DescribePayload>(
        '/api/voice/describe',
        {
          imageBase64: manipulated.base64,
          mimeType: 'image/jpeg',
        },
        { timeout: 60000 }
      );

      const description = data?.description?.trim();
      if (!description) {
        throw new Error('Empty description from backend');
      }

      if (this.cancelRequested) {
        onStage?.('idle');
        return { description, cancelled: true };
      }

      onStage?.('speaking');
      try {
        await cloudflareTTSService.speak(description);
      } catch (ttsError) {
        // Speech failure shouldn't kill the result — caller still gets the text.
        console.error('TTS error during describe:', ttsError);
      }

      onStage?.('idle');
      return { description, cancelled: false };
    } catch (err) {
      onStage?.('error');
      throw err;
    }
  }

  cancel(): void {
    this.cancelRequested = true;
    cloudflareTTSService.stop().catch(() => {
      /* ignore */
    });
  }
}

export const cameraDescribeService = new CameraDescribeService();
