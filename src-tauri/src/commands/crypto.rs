//! Module for encryption and decryption functions, using Windows DPAPI for secure key storage.

use base64::{Engine as _, engine::general_purpose};

/// Encrypt data using Windows DPAPI.
/// Encrypted data can only be decrypted under the same user account.
pub fn encrypt_data(data: &[u8]) -> Result<String, String> {
    #[cfg(target_os = "windows")]
    {
        match windows_dpapi::encrypt_data(data, windows_dpapi::Scope::User) {
            Ok(encrypted) => Ok(general_purpose::STANDARD.encode(&encrypted)),
            Err(e) => Err(format!("DPAPI encryption failed: {}", e)),
        }
    }
    #[cfg(not(target_os = "windows"))]
    {
        Err("DPAPI encryption is only available on Windows".to_string())
    }
}

/// Encrypt API key
pub fn encrypt_api_key(key: &str) -> Result<String, String> {
    encrypt_data(key.as_bytes())
}

/// Decrypt API key
pub fn decrypt_api_key(encrypted_key: &str) -> Result<String, String> {
    #[cfg(target_os = "windows")]
    {
        let encrypted = general_purpose::STANDARD
            .decode(encrypted_key)
            .map_err(|e| format!("Base64 decode failed: {}", e))?;

        match windows_dpapi::decrypt_data(&encrypted, windows_dpapi::Scope::User) {
            Ok(decrypted_bytes) => String::from_utf8(decrypted_bytes)
                .map_err(|e| format!("UTF-8 decode failed: {}", e)),
            Err(e) => Err(format!("DPAPI decryption failed: {}", e)),
        }
    }
    #[cfg(not(target_os = "windows"))]
    {
        Err("DPAPI decryption is only available on Windows".to_string())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_encrypt_decrypt_roundtrip() {
        #[cfg(target_os = "windows")]
        {
            let original = "test_api_key_12345";
            let encrypted = encrypt_api_key(original).unwrap();
            let decrypted = decrypt_api_key(&encrypted).unwrap();
            assert_eq!(original, decrypted);
        }
    }
}
