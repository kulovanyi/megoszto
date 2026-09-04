import os
import json
import firebase_db

def init_db():
    # Inicializálja a Firebase adatbázist
    return firebase_db.load_local_store()

def seed_data(conn=None):
    # Alapértelmezett Firebase mintaadatok visszaállítása
    return firebase_db.seed_initial_data()

# Delegálások a Firebase modulhoz
get_users = firebase_db.get_users
get_user_by_id = firebase_db.get_user_by_id
get_user_by_email = firebase_db.get_user_by_email
create_user = firebase_db.create_user
update_user = firebase_db.update_user
get_items = firebase_db.get_items
get_item_by_id = firebase_db.get_item_by_id
create_item = firebase_db.create_item
update_item = firebase_db.update_item
delete_item = firebase_db.delete_item
get_rentals = firebase_db.get_rentals
get_rental_by_id = firebase_db.get_rental_by_id
create_rental = firebase_db.create_rental
update_rental_status = firebase_db.update_rental_status
get_reviews_for_item = firebase_db.get_reviews_for_item
create_review = firebase_db.create_review
get_user_stats = firebase_db.get_user_stats

if __name__ == '__main__':
    init_db()
    print('Firebase database ready!')
