//! Derive macros for dependency-injector
//!
//! This crate provides the `#[derive(Inject)]` macro for automatic
//! dependency injection at compile time.
//!
//! # Example
//!
//! ```rust,ignore
//! use dependency_injector::{Container, Inject};
//! use std::sync::Arc;
//!
//! #[derive(Clone)]
//! struct Database {
//!     url: String,
//! }
//!
//! #[derive(Clone)]
//! struct Cache {
//!     size: usize,
//! }
//!
//! #[derive(Inject)]
//! struct UserService {
//!     #[inject]
//!     db: Arc<Database>,
//!     #[inject]
//!     cache: Arc<Cache>,
//!     // Non-injected fields use Default
//!     request_count: u64,
//! }
//!
//! let container = Container::new();
//! container.singleton(Database { url: "postgres://localhost".into() });
//! container.singleton(Cache { size: 1024 });
//!
//! let service = UserService::from_container(&container).unwrap();
//! ```

use proc_macro::TokenStream;
use quote::quote;
use syn::{parse_macro_input, DeriveInput, Data, Fields, Type, Attribute};

/// Derive macro for automatic dependency injection.
///
/// Generates a `from_container()` method that resolves dependencies
/// from a `Container` instance.
///
/// # Attributes
///
/// - `#[inject]` - Mark a field for injection. The field type must be `Arc<T>`.
/// - `#[inject(optional)]` - Mark a field as optional injection. Uses `Option<Arc<T>>`.
///
/// # Generated Methods
///
/// - `from_container(container: &Container) -> Result<Self, DiError>` - Creates an instance
///   by resolving all `#[inject]` fields from the container.
///
/// # Example
///
/// ```rust,ignore
/// #[derive(Inject)]
/// struct MyService {
///     #[inject]
///     db: Arc<Database>,
///     #[inject(optional)]
///     cache: Option<Arc<Cache>>,
///     // Fields without #[inject] use Default::default()
///     counter: u64,
/// }
/// ```
#[proc_macro_derive(Inject, attributes(inject))]
pub fn derive_inject(input: TokenStream) -> TokenStream {
    let input = parse_macro_input!(input as DeriveInput);
    
    let name = &input.ident;
    let generics = &input.generics;
    let (impl_generics, ty_generics, where_clause) = generics.split_for_impl();
    
    // Only support structs with named fields
    let fields = match &input.data {
        Data::Struct(data) => match &data.fields {
            Fields::Named(fields) => &fields.named,
            _ => {
                return syn::Error::new_spanned(
                    &input,
                    "Inject can only be derived for structs with named fields"
                )
                .to_compile_error()
                .into();
            }
        },
        _ => {
            return syn::Error::new_spanned(
                &input,
                "Inject can only be derived for structs"
            )
            .to_compile_error()
            .into();
        }
    };
    
    // Parse fields and generate initialization code
    let mut field_inits = Vec::new();
    
    for field in fields.iter() {
        let field_name = field.ident.as_ref().unwrap();
        let field_type = &field.ty;
        
        let inject_attr = find_inject_attr(&field.attrs);
        
        match inject_attr {
            Some(InjectAttr::Required) => {
                // Extract inner type from Arc<T>
                if let Some(inner_type) = extract_arc_inner_type(field_type) {
                    field_inits.push(quote! {
                        #field_name: container.get::<#inner_type>()?
                    });
                } else {
                    return syn::Error::new_spanned(
                        field_type,
                        "Fields marked with #[inject] must have type Arc<T>"
                    )
                    .to_compile_error()
                    .into();
                }
            }
            Some(InjectAttr::Optional) => {
                // Extract inner type from Option<Arc<T>>
                if let Some(inner_type) = extract_option_arc_inner_type(field_type) {
                    field_inits.push(quote! {
                        #field_name: container.try_get::<#inner_type>()
                    });
                } else {
                    return syn::Error::new_spanned(
                        field_type,
                        "Fields marked with #[inject(optional)] must have type Option<Arc<T>>"
                    )
                    .to_compile_error()
                    .into();
                }
            }
            None => {
                // Non-injected field - use Default
                field_inits.push(quote! {
                    #field_name: ::std::default::Default::default()
                });
            }
        }
    }
    
    // Generate the implementation
    let expanded = quote! {
        impl #impl_generics #name #ty_generics #where_clause {
            /// Create an instance by resolving dependencies from a container.
            ///
            /// All fields marked with `#[inject]` will be resolved from the container.
            /// Fields not marked with `#[inject]` will use `Default::default()`.
            pub fn from_container(
                container: &::dependency_injector::Container
            ) -> ::dependency_injector::Result<Self> {
                Ok(Self {
                    #(#field_inits),*
                })
            }
        }
    };
    
    TokenStream::from(expanded)
}

/// Types of inject attributes
enum InjectAttr {
    Required,
    Optional,
}

/// Find and parse the #[inject] attribute
fn find_inject_attr(attrs: &[Attribute]) -> Option<InjectAttr> {
    for attr in attrs {
        if attr.path().is_ident("inject") {
            // Check if it has (optional) argument
            if attr.meta.require_path_only().is_ok() {
                return Some(InjectAttr::Required);
            }
            
            // Parse inject(optional)
            if let Ok(nested) = attr.parse_args::<syn::Ident>() {
                if nested == "optional" {
                    return Some(InjectAttr::Optional);
                }
            }
            
            // Default to required
            return Some(InjectAttr::Required);
        }
    }
    None
}

/// Extract T from Arc<T>
fn extract_arc_inner_type(ty: &Type) -> Option<&Type> {
    if let Type::Path(type_path) = ty {
        let segment = type_path.path.segments.last()?;
        if segment.ident == "Arc" {
            if let syn::PathArguments::AngleBracketed(args) = &segment.arguments {
                if let Some(syn::GenericArgument::Type(inner)) = args.args.first() {
                    return Some(inner);
                }
            }
        }
    }
    None
}

/// Extract T from Option<Arc<T>>
fn extract_option_arc_inner_type(ty: &Type) -> Option<&Type> {
    if let Type::Path(type_path) = ty {
        let segment = type_path.path.segments.last()?;
        if segment.ident == "Option" {
            if let syn::PathArguments::AngleBracketed(args) = &segment.arguments {
                if let Some(syn::GenericArgument::Type(inner)) = args.args.first() {
                    return extract_arc_inner_type(inner);
                }
            }
        }
    }
    None
}

